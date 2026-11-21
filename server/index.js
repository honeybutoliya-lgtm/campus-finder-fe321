import 'dotenv/config';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedVenues } from '../src/data.js';

const { Pool } = pg;
const app = express();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 3001);
const netlifyDemoPreview = process.env.NODE_ENV === 'production' && process.env.NETLIFY === 'true' && !process.env.DATABASE_URL;
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET && !netlifyDemoPreview) throw new Error('JWT_SECRET must be set in production.');
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL && !netlifyDemoPreview) throw new Error('DATABASE_URL must be set in production.');
const jwtSecret = process.env.JWT_SECRET || (netlifyDemoPreview ? randomBytes(32).toString('hex') : 'wayin-local-development-only-change-before-deploy');
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: process.env.NETLIFY === 'true' || process.env.VERCEL === '1' ? 1 : 10,
}) : null;
const memoryVenues = structuredClone(seedVenues);
const memorySearchEvents = [];
let databaseReady = false;

app.disable('x-powered-by');
app.use(express.json({ limit: '3mb' }));

if (pool) {
  try {
    await pool.query('SELECT 1');
    databaseReady = true;
    console.log('WayIn connected to PostgreSQL.');
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      await pool.end();
      throw new Error(`PostgreSQL is required in production: ${error.message}`, { cause: error });
    }
    console.warn(`PostgreSQL is not ready; using seeded demo memory: ${error.message}`);
  }
}

function issueToken(email, role = 'admin') {
  return jwt.sign({ sub: email, role }, jwtSecret, { expiresIn: '8h', issuer: 'wayin' });
}

function requireAdmin(request, response, next) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  try {
    const claims = jwt.verify(token, jwtSecret, { issuer: 'wayin' });
    if (!['admin', 'editor'].includes(claims.role)) throw new Error('Admin role required');
    request.admin = claims;
    next();
  } catch {
    response.status(401).json({ error: 'Please sign in again.' });
  }
}

async function insertVenue(client, venue) {
  await client.query(
    'INSERT INTO venues (id, name, type, location, hours, image_url) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,location=EXCLUDED.location,hours=EXCLUDED.hours,image_url=EXCLUDED.image_url',
    [venue.id, venue.name, venue.type, venue.location, venue.hours, venue.image],
  );
  for (const [index, floor] of venue.floors.entries()) {
    await client.query('INSERT INTO floors (venue_id,id,name,level) VALUES ($1,$2,$3,$4) ON CONFLICT (venue_id,id) DO UPDATE SET name=EXCLUDED.name,level=EXCLUDED.level', [venue.id, floor.id, floor.name, index]);
  }
  for (const node of venue.nodes) {
    await client.query('INSERT INTO nodes (venue_id,id,floor_id,label,x,y,type) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (venue_id,id) DO UPDATE SET floor_id=EXCLUDED.floor_id,label=EXCLUDED.label,x=EXCLUDED.x,y=EXCLUDED.y,type=EXCLUDED.type', [venue.id, node.id, node.floorId, node.label, node.x, node.y, node.type]);
  }
  await client.query('DELETE FROM edges WHERE venue_id=$1', [venue.id]);
  for (const edge of venue.edges) {
    await client.query('INSERT INTO edges (venue_id,from_node_id,to_node_id,mode,weight_meters,accessible) VALUES ($1,$2,$3,$4,$5,$6)', [venue.id, edge.from, edge.to, edge.mode, edge.weight ?? null, edge.mode !== 'stairs']);
  }
  for (const place of venue.places) {
    await client.query('INSERT INTO places (venue_id,id,floor_id,node_id,name,map_label,category,description,hours,is_closed) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (venue_id,id) DO UPDATE SET floor_id=EXCLUDED.floor_id,node_id=EXCLUDED.node_id,name=EXCLUDED.name,map_label=EXCLUDED.map_label,category=EXCLUDED.category,description=EXCLUDED.description,hours=EXCLUDED.hours', [venue.id, place.id, place.floorId, place.nodeId, place.name, place.mapLabel ?? place.name.slice(0, 9), place.category, place.description, place.hours, Boolean(place.isClosed)]);
  }
}

async function readDatabaseVenues() {
  const venuesResult = await pool.query('SELECT id,name,type,location,hours,image_url FROM venues ORDER BY name');
  const output = [];
  for (const venue of venuesResult.rows) {
    const [floorsResult, nodesResult, edgesResult, placesResult] = await Promise.all([
      pool.query('SELECT id,name,level FROM floors WHERE venue_id=$1 ORDER BY level', [venue.id]),
      pool.query('SELECT id,label,x,y,floor_id,type FROM nodes WHERE venue_id=$1 ORDER BY id', [venue.id]),
      pool.query('SELECT from_node_id,to_node_id,mode,weight_meters,accessible FROM edges WHERE venue_id=$1', [venue.id]),
      pool.query('SELECT id,name,map_label,category,floor_id,node_id,description,hours,is_closed FROM places WHERE venue_id=$1 ORDER BY name', [venue.id]),
    ]);
    const nodes = nodesResult.rows.map((row) => ({ id: row.id, label: row.label, x: row.x, y: row.y, floorId: row.floor_id, type: row.type }));
    output.push({
      id: venue.id, name: venue.name, type: venue.type, location: venue.location, hours: venue.hours, image: venue.image_url,
      floors: floorsResult.rows.map((row) => ({ id: row.id, name: row.name, label: String(row.level) })),
      nodes,
      edges: edgesResult.rows.map((row) => ({ from: row.from_node_id, to: row.to_node_id, mode: row.mode, weight: row.weight_meters, accessible: row.accessible })),
      places: placesResult.rows.map((row) => ({ id: row.id, name: row.name, mapLabel: row.map_label || row.name.slice(0, 9), category: row.category, floorId: row.floor_id, nodeId: row.node_id, description: row.description, hours: row.hours, isClosed: row.is_closed })),
      startNodeId: nodes.find((node) => node.type === 'entrance')?.id ?? 'ground-entrance',
    });
  }
  return output;
}

app.get('/api/health', (_request, response) => response.json({ status: 'ok', storage: databaseReady ? 'postgres' : 'demo-memory' }));
app.get('/api/venues', async (_request, response) => {
  try {
    const venues = databaseReady ? await readDatabaseVenues() : memoryVenues;
    response.set('X-Wayin-Source', databaseReady ? 'postgres' : 'memory').json(venues);
  } catch (error) {
    response.status(500).json({ error: 'Venue data could not be loaded.', detail: error.message });
  }
});

app.post('/api/admin/login', async (request, response) => {
  if (process.env.NODE_ENV === 'production' && !databaseReady) {
    return response.status(503).json({ error: 'Admin sign-in is disabled until PostgreSQL is connected.' });
  }
  const email = String(request.body?.email ?? '').trim().toLowerCase();
  const password = String(request.body?.password ?? '');
  if (!email || !password) return response.status(400).json({ error: 'Email and password are required.' });
  try {
    let valid = false;
    let role = 'admin';
    if (databaseReady) {
      const result = await pool.query('SELECT password_hash,role FROM admin_users WHERE lower(email)=lower($1) AND is_active=true', [email]);
      valid = Boolean(result.rows[0] && await bcrypt.compare(password, result.rows[0].password_hash));
      if (result.rows[0]) role = result.rows[0].role;
    } else {
      valid = email === (process.env.WAYIN_ADMIN_EMAIL || 'admin@wayin.demo').toLowerCase() && password === (process.env.WAYIN_ADMIN_PASSWORD || 'wayin123');
    }
    if (!valid) return response.status(401).json({ error: 'The email or password did not match.' });
    response.json({ token: issueToken(email, role), email, role, expiresIn: 28800 });
  } catch (error) {
    response.status(500).json({ error: 'Sign-in could not be completed.', detail: error.message });
  }
});

app.get('/api/admin/analytics', requireAdmin, async (_request, response) => {
  if (!databaseReady) {
    const recent = memorySearchEvents.filter((event) => Date.now() - event.createdAt < 7 * 24 * 60 * 60 * 1000);
    const grouped = new Map();
    recent.filter((event) => event.succeeded).forEach((event) => grouped.set(event.query, (grouped.get(event.query) || 0) + 1));
    return response.json({ storage: 'demo-memory', topSearches: [...grouped].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5), failedSearches: recent.filter((event) => !event.succeeded).length });
  }
  try {
    const searches = await pool.query('SELECT query, COUNT(*)::int AS count FROM search_events WHERE succeeded=true GROUP BY query ORDER BY count DESC LIMIT 5');
    const failures = await pool.query('SELECT COUNT(*)::int AS count FROM search_events WHERE succeeded=false AND created_at > now() - interval \'7 days\'');
    response.json({ storage: 'postgres', topSearches: searches.rows.map((row) => ({ name: row.query, count: row.count })), failedSearches: failures.rows[0].count });
  } catch (error) {
    response.status(500).json({ error: 'Analytics could not be loaded.', detail: error.message });
  }
});

app.post('/api/admin/venues', requireAdmin, async (request, response) => {
  const venue = request.body?.venue;
  if (!venue?.id || !venue?.name || !venue?.floors || !venue?.nodes || !venue?.places) return response.status(400).json({ error: 'Venue map data is incomplete.' });
  try {
    if (databaseReady) {
      const client = await pool.connect();
      try { await client.query('BEGIN'); await insertVenue(client, venue); await client.query('COMMIT'); }
      catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    } else {
      const index = memoryVenues.findIndex((item) => item.id === venue.id);
      if (index >= 0) memoryVenues[index] = venue; else memoryVenues.push(venue);
    }
    response.status(201).json({ venue });
  } catch (error) {
    response.status(500).json({ error: 'Venue could not be saved.', detail: error.message });
  }
});

app.post('/api/admin/places', requireAdmin, async (request, response) => {
  const { venueId, place, node, edge } = request.body ?? {};
  if (!venueId || !place?.id || !node?.id || !edge?.from) return response.status(400).json({ error: 'Place map data is incomplete.' });
  try {
    if (databaseReady) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('INSERT INTO nodes (venue_id,id,floor_id,label,x,y,type) VALUES ($1,$2,$3,$4,$5,$6,$7)', [venueId,node.id,node.floorId,node.label,node.x,node.y,node.type]);
        await client.query('INSERT INTO edges (venue_id,from_node_id,to_node_id,mode,weight_meters,accessible) VALUES ($1,$2,$3,$4,$5,$6)', [venueId,edge.from,node.id,edge.mode || 'walk',edge.weight ?? null,edge.mode !== 'stairs']);
        await client.query('INSERT INTO places (venue_id,id,floor_id,node_id,name,map_label,category,description,hours,is_closed) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false)', [venueId,place.id,place.floorId,node.id,place.name,place.mapLabel ?? place.name.slice(0, 9),place.category,place.description,place.hours]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    } else {
      const venue = memoryVenues.find((item) => item.id === venueId);
      if (!venue) return response.status(404).json({ error: 'Venue was not found.' });
      venue.nodes.push(node); venue.edges.push({ from: edge.from, to: node.id, mode: edge.mode || 'walk', weight: edge.weight }); venue.places.push(place);
    }
    response.status(201).json({ place });
  } catch (error) {
    response.status(500).json({ error: 'Place could not be saved.', detail: error.message });
  }
});

app.patch('/api/admin/venues/:venueId/places/:placeId', requireAdmin, async (request, response) => {
  const { venueId, placeId } = request.params;
  const { name, category, isClosed } = request.body ?? {};
  try {
    if (databaseReady) {
      const result = await pool.query('UPDATE places SET name=COALESCE($3,name),category=COALESCE($4,category),is_closed=COALESCE($5,is_closed),map_label=COALESCE($6,map_label) WHERE venue_id=$1 AND id=$2 RETURNING node_id,name,map_label,category,is_closed', [venueId, placeId, name ?? null, category ?? null, typeof isClosed === 'boolean' ? isClosed : null, request.body?.mapLabel ?? null]);
      if (!result.rowCount) return response.status(404).json({ error: 'Place was not found.' });
      if (name) await pool.query('UPDATE nodes SET label=$3 WHERE venue_id=$1 AND id=$2', [venueId, result.rows[0].node_id, name]);
      return response.json({ place: result.rows[0] });
    }
    const venue = memoryVenues.find((item) => item.id === venueId);
    const place = venue?.places.find((item) => item.id === placeId);
    if (!place) return response.status(404).json({ error: 'Place was not found.' });
    if (name !== undefined) place.name = name;
    if (category !== undefined) place.category = category;
    if (typeof isClosed === 'boolean') place.isClosed = isClosed;
    const node = venue.nodes.find((item) => item.id === place.nodeId);
    if (node && name) node.label = name;
    response.json({ place });
  } catch (error) {
    response.status(500).json({ error: 'Place could not be updated.', detail: error.message });
  }
});

app.post('/api/search-events', async (request, response) => {
  const query = String(request.body?.query ?? '').trim().slice(0, 160);
  if (!query) return response.status(400).json({ error: 'Search query is required.' });
  if (!databaseReady) {
    memorySearchEvents.push({ query, succeeded: Boolean(request.body?.succeeded), createdAt: Date.now() });
    return response.status(201).json({ recorded: true });
  }
  try {
    await pool.query('INSERT INTO search_events (venue_id,query,succeeded) VALUES ($1,$2,$3)', [request.body?.venueId ?? null, query, Boolean(request.body?.succeeded)]);
    response.status(201).json({ recorded: true });
  } catch (error) {
    response.status(500).json({ error: 'Search event could not be recorded.', detail: error.message });
  }
});

if (process.env.NODE_ENV === 'production' && process.env.NETLIFY !== 'true' && process.env.VERCEL !== '1') {
  const dist = path.join(root, 'dist');
  app.use(express.static(dist, { index: false }));
  app.get(/.*/, (_request, response) => response.sendFile(path.join(dist, 'index.html')));
}

if (process.env.NETLIFY !== 'true' && process.env.VERCEL !== '1') {
  app.listen(port, () => console.log(`WayIn API ready at http://localhost:${port}${databaseReady ? ' (PostgreSQL)' : ' (seeded demo mode)'}`));
}

export default app;
