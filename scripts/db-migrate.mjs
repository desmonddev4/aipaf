import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Pool } from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required. Set it in your Vercel environment variables.');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const sql = readFileSync(join(root, 'scripts', 'db-schema.sql'), 'utf8');

try {
  await pool.query(sql);
  console.log('Database schema is up to date.');
} finally {
  await pool.end();
}
