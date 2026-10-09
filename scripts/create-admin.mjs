// Create initial admin user
// Usage: node scripts/create-admin.mjs <email> <password> <role>
// Role must be either 'secretariat' or 'council'
import { Pool } from 'pg';
import { hashPassword } from '../src/server/handlers/api/admin-auth.mjs';

const email = process.argv[2];
const password = process.argv[3];
const role = process.argv[4];

if (!email || !password || !role) {
  console.error('Usage: node scripts/create-admin.mjs <email> <password> <role>');
  console.error('Role must be either "secretariat" or "council"');
  process.exit(1);
}

if (!['secretariat', 'council'].includes(role)) {
  console.error('Role must be either "secretariat" or "council"');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required. Set it as an environment variable.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function createAdmin() {
  try {
    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      'INSERT INTO admin_users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, email_verified, created_at',
      [email.toLowerCase(), passwordHash, role]
    );

    console.log('Admin user created successfully:');
    console.log(`  Email: ${result.rows[0].email}`);
    console.log(`  Role: ${result.rows[0].role}`);
    console.log(`  ID: ${result.rows[0].id}`);
    console.log(`  Created at: ${result.rows[0].created_at}`);
    console.log('\nNote: Email verification is required on first login.');
  } catch (error) {
    if (error.code === '23505') {
      console.error('Error: An admin with this email already exists');
    } else {
      console.error('Error creating admin:', error.message);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createAdmin();
