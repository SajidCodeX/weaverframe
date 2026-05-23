import 'dotenv/config';
import { getDb } from './src/lib/db';

async function main() {
  const db = await getDb();
  console.log("=== Inspecting Database Tables ===");
  try {
    const leads = await db.lead.findMany({ take: 5 });
    console.log(`Leads count: ${await db.lead.count()}`);
    console.log("Leads sample:", leads);
  } catch (e) {
    console.error("Leads query failed:", e);
  }

  try {
    const integrations = await db.integration.findMany();
    console.log(`Integrations count: ${integrations.length}`);
    console.log("Integrations:", integrations);
  } catch (e) {
    console.error("Integrations query failed:", e);
  }

  try {
    const activities = await db.activity.findMany({ take: 5 });
    console.log(`Activities count: ${await db.activity.count()}`);
    console.log("Activities sample:", activities);
  } catch (e) {
    console.error("Activities query failed:", e);
  }

  process.exit(0);
}

main().catch(console.error);
