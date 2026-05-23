import 'dotenv/config';
import { getDb } from './db';

async function main() {
  const db = await getDb();
  const statuses = await db.lead.groupBy({
    by: ['status'],
    _count: true,
  });
  console.log("Status distribution:", statuses);

  const scoreTiers = await db.lead.groupBy({
    by: ['scoreTier'],
    _count: true,
  });
  console.log("Score Tier distribution:", scoreTiers);

  process.exit(0);
}

main().catch(console.error);
