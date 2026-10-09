import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Pool } from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required. Set it in your environment variables.');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

const downloads = [
  {
    type: 'download',
    slug: 'pabok',
    title: 'Project Assurance Body of Knowledge',
    summary: 'Comprehensive guide to project assurance principles and practices',
    body: 'The AIPAF Project Assurance Body of Knowledge (PABOK) provides the foundational framework for project assurance professionals across Africa.',
    status: 'published',
    metadata: JSON.stringify({
      fileUrl: '/media/AIPAF_PABOK.docx',
      fileType: 'docx',
      fileSize: '30KB',
      category: 'body-of-knowledge'
    })
  },
  {
    type: 'download',
    slug: 'pfbok',
    title: 'Project Forensics Body of Knowledge',
    summary: 'Guide to project investigation and forensic analysis',
    body: 'The AIPAF Project Forensics Body of Knowledge (PFBOK) establishes standards for project investigation, forensic analysis, and evidence preservation.',
    status: 'published',
    metadata: JSON.stringify({
      fileUrl: '/media/AIPAF_PFBOK.docx',
      fileType: 'docx',
      fileSize: '30KB',
      category: 'body-of-knowledge'
    })
  },
  {
    type: 'download',
    slug: 'ac-pmbok',
    title: 'Certified Project Management Body of Knowledge',
    summary: 'Advanced project management standards for certified professionals',
    body: 'The AIPAF Certified Project Management Body of Knowledge (AcPMBOK) provides advanced methodologies for project management at the certified and chartered levels.',
    status: 'published',
    metadata: JSON.stringify({
      fileUrl: '/media/AIPAF_AcPMBOK.docx',
      fileType: 'docx',
      fileSize: '35KB',
      category: 'body-of-knowledge'
    })
  },
  {
    type: 'download',
    slug: 'schedule-of-members',
    title: 'Schedule of Members',
    summary: 'Official member registry and organizational structure',
    body: 'The Schedule of Members (Annex 2 to Form A) provides the official registry of AIPAF members and the organizational structure of the Institute.',
    status: 'published',
    metadata: JSON.stringify({
      fileUrl: '/media/AIPAF - Schedule of Members (Annex 2 to Form A).docx',
      fileType: 'docx',
      fileSize: '32KB',
      category: 'governance'
    })
  }
];

async function addDownloadsToCMS() {
  const client = await pool.connect();
  try {
    for (const download of downloads) {
      // Check if already exists
      const existing = await client.query(
        'SELECT id FROM cms_content WHERE slug = $1',
        [download.slug]
      );

      if (existing.rowCount > 0) {
        console.log(`✓ Download "${download.title}" already exists (slug: ${download.slug})`);
        continue;
      }

      // Insert new download
      await client.query(
        `INSERT INTO cms_content (type, slug, title, summary, body, status, published_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
        [
          download.type,
          download.slug,
          download.title,
          download.summary,
          download.body,
          download.status,
          download.metadata
        ]
      );

      console.log(`✓ Added download "${download.title}" (slug: ${download.slug})`);
    }

    console.log('\nAll downloads have been added to the CMS.');
  } catch (error) {
    console.error('Error adding downloads to CMS:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

addDownloadsToCMS();
