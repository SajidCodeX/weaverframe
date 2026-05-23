const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  await pool.query('DELETE FROM "PublicReview"');
  await pool.query('DELETE FROM "ReviewRequest"');
  console.log('Cleared all dummy reviews!');
  await pool.end();
}
run().catch(console.error);
