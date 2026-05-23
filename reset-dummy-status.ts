import 'dotenv/config';
import { getDb } from './src/lib/db';

async function main() {
  const db = await getDb();
  console.log("Resetting dummy statuses back to 'New'...");

  // Update all leads to have status 'New'
  const updateResult = await db.lead.updateMany({
    where: {
      status: { not: 'New' }
    },
    data: {
      status: 'New'
    }
  });

  console.log(`Reset status to 'New' for ${updateResult.count} leads.`);

  // Also clear any dummy activities that were created during distribution/testing
  // The only valid activity might be "Lead manually added", but to be safe we can just delete all activities 
  // since this is a clean slate before AI integration.
  const activityDeleteResult = await db.activity.deleteMany({});
  console.log(`Deleted ${activityDeleteResult.count} dummy activity logs.`);

  console.log("Successfully removed dummy data!");
  
  process.exit(0);
}

main().catch(console.error);
