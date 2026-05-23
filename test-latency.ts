import 'dotenv/config';
import { getDb } from './src/lib/db';

async function test() {
  console.log("Measuring optimized database queries...");
  
  const start = Date.now();
  const db = await getDb();
  console.log(`Prisma Client initialized in ${Date.now() - start}ms`);

  const q1Start = Date.now();
  const [
    totalLeads,
    qualifiedLeads,
    builderNotified,
    appointmentsSet,
    hotCount,
    warmCount,
    coldCount
  ] = await Promise.all([
    db.lead.count(),
    db.lead.count({ where: { NOT: { status: 'New' } } }),
    db.lead.count({ where: { status: { in: ['Builder Notified', 'Appointment', 'Replied'] } } }),
    db.lead.count({ where: { status: 'Appointment' } }),
    db.lead.count({ where: { scoreTier: 'Hot' } }),
    db.lead.count({ where: { scoreTier: 'Warm' } }),
    db.lead.count({ where: { scoreTier: 'Cold' } }),
  ]);
  console.log(`Aggregates fetched in ${Date.now() - q1Start}ms`);
  console.log(`Counts: total=${totalLeads}, qualified=${qualifiedLeads}, hot=${hotCount}`);

  const q2Start = Date.now();
  const recentActivitiesRaw = await db.activity.findMany({
    take: 7,
    orderBy: { createdAt: 'desc' },
    include: { lead: true },
  });
  console.log(`Recent activities fetched in ${Date.now() - q2Start}ms`);

  console.log(`Total roundtrip time: ${Date.now() - start}ms`);
  process.exit(0);
}

test().catch(console.error);
