import 'dotenv/config';
import { getDb } from './src/lib/db';

async function main() {
  const db = await getDb();
  console.log("=== Inspecting Database Tables ===");
  try {
    console.log("Leads count:", await db.lead.count());
    console.log("Activities count:", await db.activity.count());
    console.log("ReviewPlatforms count:", await db.reviewPlatform.count());
    console.log("ReviewRequests count:", await db.reviewRequest.count());
    console.log("Appointments count:", await db.appointment.count());
    console.log("Messages count:", await db.message.count());
  } catch (e) {
    console.error("Query failed:", e);
  }
  process.exit(0);
}

main().catch(console.error);
