CREATE TABLE IF NOT EXISTS venues (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  location text NOT NULL DEFAULT '',
  hours text NOT NULL DEFAULT '',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS floors (
  venue_id text NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL,
  level integer NOT NULL,
  map_image_url text,
  PRIMARY KEY (venue_id, id),
  UNIQUE (venue_id, level)
);

CREATE TABLE IF NOT EXISTS nodes (
  venue_id text NOT NULL,
  id text NOT NULL,
  floor_id text NOT NULL,
  label text NOT NULL,
  x double precision NOT NULL,
  y double precision NOT NULL,
  type text NOT NULL,
  PRIMARY KEY (venue_id, id),
  FOREIGN KEY (venue_id, floor_id) REFERENCES floors(venue_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS edges (
  id bigserial PRIMARY KEY,
  venue_id text NOT NULL,
  from_node_id text NOT NULL,
  to_node_id text NOT NULL,
  mode text NOT NULL DEFAULT 'walk' CHECK (mode IN ('walk', 'lift', 'stairs', 'ramp')),
  weight_meters double precision,
  accessible boolean NOT NULL DEFAULT true,
  FOREIGN KEY (venue_id, from_node_id) REFERENCES nodes(venue_id, id) ON DELETE CASCADE,
  FOREIGN KEY (venue_id, to_node_id) REFERENCES nodes(venue_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS places (
  venue_id text NOT NULL,
  id text NOT NULL,
  floor_id text NOT NULL,
  node_id text NOT NULL,
  name text NOT NULL,
  map_label text NOT NULL DEFAULT '',
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  hours text NOT NULL DEFAULT '',
  photo_url text,
  is_closed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (venue_id, id),
  FOREIGN KEY (venue_id, floor_id) REFERENCES floors(venue_id, id) ON DELETE CASCADE,
  FOREIGN KEY (venue_id, node_id) REFERENCES nodes(venue_id, id) ON DELETE CASCADE
);

ALTER TABLE places ADD COLUMN IF NOT EXISTS map_label text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS admin_users (
  id bigserial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'editor')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS search_events (
  id bigserial PRIMARY KEY,
  venue_id text REFERENCES venues(id) ON DELETE SET NULL,
  query text NOT NULL,
  succeeded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nodes_floor_idx ON nodes (venue_id, floor_id);
CREATE INDEX IF NOT EXISTS places_venue_category_idx ON places (venue_id, category);
CREATE INDEX IF NOT EXISTS search_events_created_idx ON search_events (created_at DESC);
