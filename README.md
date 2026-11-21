# WayIn

WayIn is a responsive indoor wayfinding demo for visitors using a phone, tablet, kiosk or desktop browser. Visitors can search a venue, choose a starting point, pick a destination and follow a floor-by-floor route without creating an account.

## Included

- React, Vite and Tailwind CSS frontend with light/dark themes and English/Hindi labels.
- Three seeded two-floor venues: City Mall, Green Valley School and Palm Bay Resort.
- Interactive SVG floor maps with room selection, pan/zoom, route highlighting and floor tabs.
- Dijkstra shortest paths, step-free routing, estimated distance/time and generated turn directions.
- Camera QR scanning where the browser supports `BarcodeDetector`, plus a printed-code fallback.
- Place details, route links/QRs, voice guidance, favourites, recent searches, help and emergency-exit shortcuts.
- Express API with server-side admin sign-in. It runs against seeded in-memory data without PostgreSQL, or uses PostgreSQL when `DATABASE_URL` is configured.
- Admin venue/place CRUD, temporary closures, floor-plan image preview and analytics endpoints.
- PostgreSQL schema and repeatable seed script in `database/`.
- PWA shell caching for subsequent offline visits.

## Run the demo

Requires Node.js 20.19+ or 22.12+.

```powershell
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API runs at `http://localhost:3001`; the Vite dev server proxies `/api` requests to it. With no `DATABASE_URL`, the API starts in seeded memory mode.

Demo admin account:

- Email: `admin@wayin.demo`
- Password: `wayin123`

The demo admin is intentionally only a local prototype account. It is not suitable for a public deployment.

## PostgreSQL setup

1. Create a PostgreSQL database and copy `.env.example` to `.env`.
2. Set `DATABASE_URL`, `JWT_SECRET`, `WAYIN_ADMIN_EMAIL` and `WAYIN_ADMIN_PASSWORD` in `.env`.
3. Initialize the schema and seed the sample venues:

```powershell
npm run db:seed
```

The seed script creates the schema if needed, inserts the sample venues and floor graphs, and creates/updates the admin account from the environment variables. Admin passwords are stored as bcrypt hashes. Keep the database URL and secrets private.

## Netlify deployment

Netlify serves the Vite frontend and runs the Express API as a Function. You can publish the sample maps as a read-only demo first; admin sign-in and persistent venue edits stay disabled until an external PostgreSQL database is connected.

1. Open the Netlify import link for `honeybutoliya-lgtm/campus-finder` and select the `wayin-netlify` branch. The included `netlify.toml` sets the build command, `dist` publish folder, Functions directory, API rewrite, and SPA fallback.
2. Deploy. Netlify will provide a public `*.netlify.app` address. In the demo-only mode, visitors can navigate the bundled sample maps; admin login is intentionally unavailable.
3. To enable the real college map and admin editing, create an external PostgreSQL database and initialize its schema and first admin. In PowerShell, replace the example values, then run:

   ```powershell
   $env:NODE_ENV = "production"
   $env:DATABASE_URL = "<your PostgreSQL connection string>"
   $env:WAYIN_ADMIN_EMAIL = "you@college.edu"
   $env:WAYIN_ADMIN_PASSWORD = "<unique password, at least 16 characters>"
   $env:WAYIN_SEED_DEMO_VENUES = "false"
   npm run db:seed
   ```

   The seed command is repeatable and will not add demo venues when that flag is `false`.
4. Add `DATABASE_URL` and a strong, random `JWT_SECRET` under the Netlify site's environment variables, scoped to Functions. Generate a JWT secret with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. Set `PGSSL=true` if required by your database provider. Do not put secrets in frontend `VITE_` variables or commit them.
5. Redeploy. Check `/api/health`; the response should show `"storage":"postgres"`. Then open `/?view=admin` and sign in with the admin created in step 3.

The Netlify Function reuses the Express API, and its PostgreSQL connection pool is limited to one connection per function instance. A real venue still needs a surveyed floor plan and calibrated walkway graph before its routes can be trusted. The floor-plan upload currently previews locally; it does not digitize or calibrate the map.

## Tests and production build

```powershell
npm test
npm run build
```

For standalone Express hosting, set `NODE_ENV=production`, `DATABASE_URL`, and `JWT_SECRET` before `npm run start:production`. For Netlify, use the Function and redirects configured in `netlify.toml`.

## Data model

The PostgreSQL model is `venues -> floors -> nodes -> edges` with `places` attached to a floor and navigation node. `edges.mode` distinguishes walking, lifts, stairs and ramps. A step-free route excludes stairs. `admin_users` stores role-based admin identities, while `search_events` supports aggregate search analytics. See `database/schema.sql` and `database/seed.js`.

## Demo boundaries

The sample maps are schematic and use generated coordinates; a real venue needs a verified floor plan and surveyed walkway graph. The upload control previews a plan locally but does not digitize or calibrate it. Live navigation estimates progress from phone step-motion events, follows that estimate along the selected route, and supports QR signs as known-location checkpoints. Step estimates drift and are not a substitute for positioning; accurate automatic indoor location requires venue-specific infrastructure such as Bluetooth beacons or a calibrated Wi-Fi positioning system. Phone motion sensors require a supported browser, permission, and a secure origin (HTTPS; localhost is also secure). The default no-database mode keeps admin edits in memory on the API and in browser storage, so restarting the API restores its bundled seed data. Configure PostgreSQL for persistent venue records.

Replace the demonstration reception phone number in the Help screen before using this with real visitors.
