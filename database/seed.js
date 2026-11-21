import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { seedVenues } from '../src/data.js';

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL before seeding PostgreSQL.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && (!process.env.WAYIN_ADMIN_EMAIL || !process.env.WAYIN_ADMIN_PASSWORD)) {
  console.error('Set WAYIN_ADMIN_EMAIL and WAYIN_ADMIN_PASSWORD before production setup.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && process.env.WAYIN_ADMIN_PASSWORD.length < 16) {
  console.error('WAYIN_ADMIN_PASSWORD must be at least 16 characters in production.');
  process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined });
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  await pool.query(await readFile(path.join(root, 'database', 'schema.sql'), 'utf8'));
  const client = await pool.connect();
  let seededVenues = 0;
  try {
    await client.query('BEGIN');
    for (const venue of seedVenues) {
      if (process.env.WAYIN_SEED_DEMO_VENUES === 'false') continue;
      const existing = await client.query('SELECT 1 FROM venues WHERE id=$1', [venue.id]);
      if (existing.rowCount) continue;
      await client.query('INSERT INTO venues (id,name,type,location,hours,image_url) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,location=EXCLUDED.location,hours=EXCLUDED.hours,image_url=EXCLUDED.image_url', [venue.id,venue.name,venue.type,venue.location,venue.hours,venue.image]);
      seededVenues += 1;
      for (const [level, floor] of venue.floors.entries()) {
        await client.query('INSERT INTO floors (venue_id,id,name,level) VALUES ($1,$2,$3,$4) ON CONFLICT (venue_id,id) DO UPDATE SET name=EXCLUDED.name,level=EXCLUDED.level', [venue.id,floor.id,floor.name,level]);
      }
      for (const node of venue.nodes) {
        await client.query('INSERT INTO nodes (venue_id,id,floor_id,label,x,y,type) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (venue_id,id) DO UPDATE SET floor_id=EXCLUDED.floor_id,label=EXCLUDED.label,x=EXCLUDED.x,y=EXCLUDED.y,type=EXCLUDED.type', [venue.id,node.id,node.floorId,node.label,node.x,node.y,node.type]);
      }
      await client.query('DELETE FROM edges WHERE venue_id=$1', [venue.id]);
      for (const edge of venue.edges) await client.query('INSERT INTO edges (venue_id,from_node_id,to_node_id,mode,weight_meters,accessible) VALUES ($1,$2,$3,$4,$5,$6)', [venue.id,edge.from,edge.to,edge.mode,edge.weight ?? null,edge.mode !== 'stairs']);
      for (const place of venue.places) {
        await client.query('INSERT INTO places (venue_id,id,floor_id,node_id,name,map_label,category,description,hours,is_closed) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false) ON CONFLICT (venue_id,id) DO UPDATE SET floor_id=EXCLUDED.floor_id,node_id=EXCLUDED.node_id,name=EXCLUDED.name,map_label=EXCLUDED.map_label,category=EXCLUDED.category,description=EXCLUDED.description,hours=EXCLUDED.hours', [venue.id,place.id,place.floorId,place.nodeId,place.name,place.mapLabel ?? place.name.slice(0, 9),place.category,place.description,place.hours]);
      }
    }
    if (process.env.WAYIN_ADMIN_EMAIL && process.env.WAYIN_ADMIN_PASSWORD) {
      const hash = await bcrypt.hash(process.env.WAYIN_ADMIN_PASSWORD, 12);
      await client.query('INSERT INTO admin_users (email,password_hash) VALUES ($1,$2) ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash,is_active=true', [process.env.WAYIN_ADMIN_EMAIL, hash]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  console.log(`Seeded ${seededVenues} sample venues; schema and admin are ready.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
