import 'dotenv/config';
import { getDb } from './src/lib/db';

async function main() {
  const db = await getDb();
  console.log("=== Cleaning Database of Dummy Records ===");
  try {
    const deletedMessages = await db.message.deleteMany({});
    console.log(`Deleted ${deletedMessages.count} dummy message records.`);
    
    const deletedActivities = await db.activity.deleteMany({});
    console.log(`Deleted ${deletedActivities.count} dummy activity records.`);
    
    const deletedAppointments = await db.appointment.deleteMany({});
    console.log(`Deleted ${deletedAppointments.count} dummy appointments.`);
    
    const deletedReviewRequests = await db.reviewRequest.deleteMany({});
    console.log(`Deleted ${deletedReviewRequests.count} dummy review requests.`);
    
    console.log("Database successfully cleaned of all dummy data records!");
  } catch (e) {
    console.error("Cleanup failed:", e);
  }
  process.exit(0);
}

main().catch(console.error);
