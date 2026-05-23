import 'dotenv/config'
import { getDb } from '../src/lib/db'

async function check() {
  const db = await getDb()
  const leadsCount = await db.lead.count()
  const messagesCount = await db.message.count()
  const appointmentsCount = await db.appointment.count()
  const activitiesCount = await db.activity.count()
  
  console.log(`Leads: ${leadsCount}`)
  console.log(`Messages: ${messagesCount}`)
  console.log(`Appointments: ${appointmentsCount}`)
  console.log(`Activities: ${activitiesCount}`)
  
  if (leadsCount > 0) {
    const leads = await db.lead.findMany({
      take: 5,
      include: {
        messages: true
      }
    })
    console.log("Sample Leads and their messages count:")
    leads.forEach(l => {
      console.log(`- Lead: ${l.name} (ID: ${l.id}), messages: ${l.messages.length}`)
    })
  }
}

check().catch(console.error)
