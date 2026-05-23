import { getDb } from '../src/lib/db';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log("Testing database connection...");
  try {
    const db = await getDb();
    console.log("Database client initialized.");
    const leadsCount = await db.lead.count();
    console.log("Leads count:", leadsCount);
    
    const integrations = await db.integration.findMany();
    console.log("Integrations:", integrations);
    
    console.log("Database connection successful!");
  } catch (error) {
    console.error("Database connection failed:", error);
  }
}

main();
