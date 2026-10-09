import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Pool } from 'pg';
import { randomBytes } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required. Set it in your environment variables.');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

// Generate invitation token
function generateInvitationToken() {
  return randomBytes(32).toString('hex');
}

// Map document class to database grade
function mapGradeToDb(documentClass) {
  const mapping = {
    'Fellow': 'fellow',
    'Member': 'member',
    'Associate': 'associate',
    'Affiliate': 'affiliate',
    'Honorary Fellow': 'fellow', // Honorary fellows get fellow grade
    'Graduate': 'affiliate', // Graduates start as affiliate
  };
  return mapping[documentClass] || 'affiliate';
}

// CSV format expected: No,Full name,Professional qualification,Class,Institutional affiliation and address for service,Source,Consent,In coverage
async function importFromCSV(csvPath) {
  const client = await pool.connect();
  try {
    const csvContent = readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // Skip header
    const headerLine = lines[0];
    const dataLines = lines.slice(1);
    
    console.log(`Found ${dataLines.length} entries to import`);
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const line of dataLines) {
      try {
        const fields = line.split(',').map(f => f.trim().replace(/^"|"$/g, ''));
        
        if (fields.length < 4) {
          console.log(`Skipping malformed line: ${line.substring(0, 50)}...`);
          skipped++;
          continue;
        }
        
        const [no, fullName, qualification, docClass, affiliation, source, consent, inCoverage] = fields;
        
        if (!fullName || !docClass) {
          console.log(`Skipping entry ${no}: missing name or class`);
          skipped++;
          continue;
        }
        
        // Extract email from affiliation if present
        const emailMatch = affiliation.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        const email = emailMatch ? emailMatch[1] : null;
        
        if (!email) {
          console.log(`Skipping entry ${no} (${fullName}): no email found`);
          skipped++;
          continue;
        }
        
        // Check if invitation already exists
        const existing = await client.query(
          'SELECT id FROM member_invitations WHERE email = $1',
          [email]
        );
        
        if (existing.rowCount > 0) {
          console.log(`Skipping ${no} (${fullName}): invitation already exists`);
          skipped++;
          continue;
        }
        
        const grade = mapGradeToDb(docClass);
        const token = generateInvitationToken();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        
        await client.query(
          `INSERT INTO member_invitations 
           (email, full_name, proposed_grade, qualification, affiliation, source, invitation_token, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [email, fullName, grade, qualification, affiliation, source, token, expiresAt]
        );
        
        console.log(`✓ Imported ${no}: ${fullName} (${grade})`);
        imported++;
      } catch (error) {
        console.error(`Error importing line: ${line.substring(0, 100)}...`, error.message);
        errors++;
      }
    }
    
    console.log('\n=== Import Summary ===');
    console.log(`Imported: ${imported}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total processed: ${dataLines.length}`);
    
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Manual entry mode
async function createManualInvitation(email, fullName, grade, qualification, affiliation) {
  const client = await pool.connect();
  try {
    const token = generateInvitationToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    await client.query(
      `INSERT INTO member_invitations 
       (email, full_name, proposed_grade, qualification, affiliation, invitation_token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [email, fullName, grade, qualification, affiliation, token, expiresAt]
    );
    
    console.log(`✓ Created invitation for ${fullName} (${grade})`);
    console.log(`   Token: ${token}`);
    console.log(`   Acceptance URL: ${process.env.SITE_URL || 'http://localhost:3000'}/accept-invitation?token=${token}`);
  } catch (error) {
    console.error('Failed to create invitation:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (command === 'csv' && args[1]) {
  importFromCSV(args[1]);
} else if (command === 'manual') {
  if (args.length < 6) {
    console.log('Usage: node scripts/import-member-invitations.mjs manual <email> <fullName> <grade> <qualification> <affiliation>');
    console.log('Grades: fellow, member, associate, affiliate, graduate');
    process.exit(1);
  }
  createManualInvitation(args[1], args[2], args[3], args[4], args[5]);
} else {
  console.log('Usage:');
  console.log('  node scripts/import-member-invitations.mjs csv <path-to-csv>');
  console.log('  node scripts/import-member-invitations.mjs manual <email> <fullName> <grade> <qualification> <affiliation>');
  console.log('');
  console.log('CSV format: No,Full name,Professional qualification,Class,Institutional affiliation and address for service,Source,Consent,In coverage');
  process.exit(1);
}
