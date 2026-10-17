import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing. Add it to .env.local first.');
}

const dataPath = path.join(process.cwd(), 'data', 'farm-data.json');
const farmData = JSON.parse(await readFile(dataPath, 'utf8'));
const sql = neon(databaseUrl);

await sql`CREATE TABLE IF NOT EXISTS fieldnote_farm (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

const existing = await sql`SELECT id FROM fieldnote_farm WHERE id = 'main'`;
if (existing.length && !process.argv.includes('--overwrite')) {
  throw new Error(
    'Cloud farm data already exists. No changes made. Use --overwrite only if you intend to replace it.',
  );
}

await sql`INSERT INTO fieldnote_farm (id, data, updated_at)
  VALUES ('main', ${JSON.stringify(farmData)}::jsonb, NOW())
  ON CONFLICT (id) DO UPDATE
  SET data = EXCLUDED.data, updated_at = NOW()`;
console.log('Farm records copied to Neon. The local JSON file was not changed.');
