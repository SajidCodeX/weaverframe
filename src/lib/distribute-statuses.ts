import 'dotenv/config';
import { getDb } from './db';

async function main() {
  const db = await getDb();
  console.log("Optimizing status distribution with concurrent chunked updates...");

  const leads = await db.lead.findMany();
  console.log(`Found ${leads.length} leads in the database.`);

  const chunkSize = 50;
  for (let i = 0; i < leads.length; i += chunkSize) {
    const chunk = leads.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (lead) => {
        let status = "New";
        const nameHash = lead.name.charCodeAt(0) + (lead.name.charCodeAt(lead.name.length - 1) || 0);

        if (lead.scoreTier === "Hot") {
          const val = nameHash % 10;
          if (val < 4) status = "Appointment";
          else if (val < 7) status = "Replied";
          else if (val < 9) status = "Opened";
          else status = "Emailed";
        } else if (lead.scoreTier === "Warm") {
          const val = nameHash % 10;
          if (val < 2) status = "Appointment";
          else if (val < 5) status = "Replied";
          else if (val < 8) status = "Opened";
          else status = "Emailed";
        } else {
          // Cold
          const val = nameHash % 10;
          if (val < 1) status = "Opened";
          else if (val < 3) status = "Emailed";
          else status = "New";
        }

        return db.lead.update({
          where: { id: lead.id },
          data: { status },
        });
      })
    );
    console.log(`Updated ${Math.min(i + chunkSize, leads.length)}/${leads.length} leads...`);
  }

  console.log("Successfully completed status distribution!");
  
  // Verify final counts
  const [total, qualified, appointments] = await Promise.all([
    db.lead.count(),
    db.lead.count({ where: { NOT: { status: 'New' } } }),
    db.lead.count({ where: { status: 'Appointment' } }),
  ]);
  console.log(`New Counts -> Total: ${total}, Qualified: ${qualified}, Appointments: ${appointments}`);
  
  process.exit(0);
}

main().catch(console.error);
