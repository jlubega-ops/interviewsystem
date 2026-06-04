/**
 * Fix MySQL "Illegal mix of collations" by normalizing table collation.
 * Uses DATABASE_URL from .env. No mysql CLI needed.
 * Usage: node scripts/fix-collation.js
 */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

function parseDatabaseUrl(url) {
  if (!url || !url.startsWith('mysql://')) {
    throw new Error('DATABASE_URL must be set and start with mysql://');
  }
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port || '3306', 10),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password || ''),
    database: u.pathname.replace(/^\//, '').split('?')[0] || undefined,
  };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '..', 'prisma', 'fix-collation.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const config = parseDatabaseUrl(url);
  console.log('Connecting to', config.host + ':' + config.port + '/' + config.database + '...');

  const conn = await mysql.createConnection({ ...config, multipleStatements: true });
  try {
    await conn.query(sql);
    console.log('✅ Collation fix applied successfully.');
    console.log('   Optional: add ?collation=utf8mb4_unicode_ci to DATABASE_URL in .env');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
