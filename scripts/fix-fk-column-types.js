/**
 * Runs the FK column-type fix SQL using DATABASE_URL from .env.
 * Usage: node scripts/fix-fk-column-types.js
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
    database: u.pathname.replace(/^\//, '') || undefined,
  };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '..', 'prisma', 'fix-fk-column-types.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const config = parseDatabaseUrl(url);
  console.log('Connecting to', config.host + ':' + config.port + '/' + config.database + '...');

  const conn = await mysql.createConnection({ ...config, multipleStatements: true });
  try {
    await conn.query(sql);
    console.log('✅ fix-fk-column-types.sql ran successfully.');
    console.log('   Run: npx prisma db push');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
