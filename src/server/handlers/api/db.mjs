import { Pool } from 'pg';

const pool = process.env.DATABASE_URL ? new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
}) : null;

export const db = {
  query(text, params) {
    if (!pool) throw new Error('DATABASE_URL is not configured.');
    return pool.query(text, params);
  },
};

export async function withDb(operation) {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  const client = await pool.connect();
  try {
    return await operation(client);
  } finally {
    client.release();
  }
}

// Older databases may not have the consent column yet (run `npm run db:migrate`); still save the submission.
const isMissingColumn = (error) => error?.code === '42703';

export async function saveContactSubmission(data) {
  return withDb(async (client) => {
    const base = [data.name, data.email, data.topic, data.message, data._elapsedMs, data._page];
    try {
      const result = await client.query(
        `INSERT INTO contact_messages (name, email, topic, message, elapsed_ms, page, consent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id, created_at;`,
        [...base, data.consent === true],
      );
      return result.rows[0];
    } catch (error) {
      if (!isMissingColumn(error)) throw error;
      const result = await client.query(
        `INSERT INTO contact_messages (name, email, topic, message, elapsed_ms, page, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id, created_at;`,
        base,
      );
      return result.rows[0];
    }
  });
}

export async function saveMembershipSubmission(data) {
  return withDb(async (client) => {
    const base = [
      data.name, data.email, data.organisation || null, data.country, data.registering_as,
      data.area_of_practice || null, data.message || null, data._elapsedMs, data._page,
    ];
    try {
      const result = await client.query(
        `INSERT INTO membership_interests (
          name, email, organisation, country, registering_as, area_of_practice, message,
          elapsed_ms, page, consent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING id, created_at;`,
        [...base, data.consent === true],
      );
      return result.rows[0];
    } catch (error) {
      if (!isMissingColumn(error)) throw error;
      const result = await client.query(
        `INSERT INTO membership_interests (
          name, email, organisation, country, registering_as, area_of_practice, message,
          elapsed_ms, page, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING id, created_at;`,
        base,
      );
      return result.rows[0];
    }
  });
}

export async function markSubmissionStatus(table, id, status) {
  if (!pool) return;
  await withDb(async (client) => {
    await client.query(`UPDATE ${table} SET email_status = $1, updated_at = NOW() WHERE id = $2;`, [status, id]);
  });
}

export async function pingDatabase() {
  if (!pool) return false;
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
