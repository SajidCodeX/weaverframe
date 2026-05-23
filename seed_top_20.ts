import 'dotenv/config';
import { getDb } from './src/lib/db';
import fs from 'fs';
import path from 'path';

async function main() {
  const db = await getDb();
  console.log("Wiping current database...");
  await db.activity.deleteMany({});
  await db.lead.deleteMany({});
  console.log("Database wiped!");

  const raw = fs.readFileSync(path.join(process.cwd(), 'austin_leads.json'), 'utf8');
  const leadsData = JSON.parse(raw);

  console.log(`Inserting ${leadsData.length} premium leads without contractors...`);

  const created = await Promise.all(leadsData.map(async (lead: any) => {
    return await db.lead.create({
      data: {
        name: lead.name,
        county: lead.county,
        state: lead.state,
        landPrice: lead.budget,
        estimatedBudget: lead.budget, // For Austin permits, total_job_valuation is the construction budget directly.
        purchaseDate: lead.issue_date ? new Date(lead.issue_date) : new Date(),
        phone: lead.phone || null,
        email: null,
        status: "New",
        scoreTier: lead.score_tier,
        source: "Austin Building Permits",
      }
    });
  }));

  console.log(`Successfully seeded ${created.length} Premium Austin leads.`);
  process.exit(0);
}

main().catch(console.error);
