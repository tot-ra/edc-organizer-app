import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Database lives in <repo>/data/edc.db by default; override with EDC_DB_PATH (":memory:" for tests).
const here = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.EDC_DB_PATH ?? resolve(here, '../../data/edc.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('person','car','rv','house')),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS bags (
  id INTEGER PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('pouch','backpack','case','box','drawer','bag')),
  slot TEXT NOT NULL DEFAULT 'default',
  volume_l REAL NOT NULL DEFAULT 1,
  empty_weight_g REAL NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#7c8cff',
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY,
  bag_id INTEGER NOT NULL REFERENCES bags(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  placement TEXT NOT NULL DEFAULT 'main',
  volume_l REAL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'misc',
  weight_g REAL NOT NULL DEFAULT 0,
  length_cm REAL NOT NULL DEFAULT 1,
  width_cm REAL NOT NULL DEFAULT 1,
  height_cm REAL NOT NULL DEFAULT 1,
  shape TEXT NOT NULL DEFAULT 'box',
  color TEXT NOT NULL DEFAULT '#cfd3dc',
  notes TEXT NOT NULL DEFAULT '',
  section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  position_x_cm REAL,
  position_y_cm REAL,
  position_z_cm REAL,
  rotation_x_deg REAL NOT NULL DEFAULT 0,
  rotation_y_deg REAL NOT NULL DEFAULT 0,
  rotation_z_deg REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_bags_location ON bags(location_id);
CREATE INDEX IF NOT EXISTS idx_sections_bag ON sections(bag_id);
CREATE INDEX IF NOT EXISTS idx_items_section ON items(section_id);
`;

const ITEM_PLACEMENT_COLUMNS = [
  ['position_x_cm', 'REAL'], ['position_y_cm', 'REAL'], ['position_z_cm', 'REAL'],
  ['rotation_x_deg', 'REAL NOT NULL DEFAULT 0'], ['rotation_y_deg', 'REAL NOT NULL DEFAULT 0'], ['rotation_z_deg', 'REAL NOT NULL DEFAULT 0'],
] as const;

/** SQLite has no `ADD COLUMN IF NOT EXISTS`, so evolve existing local databases explicitly. */
function migrate(db: DatabaseSync): void {
  const columns = new Set((db.prepare('PRAGMA table_info(items)').all() as Array<{ name: string }>).map((column) => column.name));
  for (const [name, definition] of ITEM_PLACEMENT_COLUMNS) {
    if (!columns.has(name)) db.exec(`ALTER TABLE items ADD COLUMN ${name} ${definition}`);
  }
}

export function openDb(path: string = DB_PATH): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

export const db = openDb();
