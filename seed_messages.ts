import 'dotenv/config'
import { getDb } from './src/lib/db'

async function main() {
  const prisma = await getDb()

  console.log("Fetching leads from database...")
  const leads = await prisma.lead.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  })

  if (leads.length === 0) {
    console.log("No leads found in database. Please run seed.ts first.")
    return
  }

  console.log(`Found ${leads.length} leads. Seeding messages...`)

  // Define some realistic home building conversations
  const conversations = [
    [
      { sender: 'lead', content: "Hi there! I saw you recently pulled a permit for a custom home build in Travis County. Do you have any similar floor plans available?", delayDays: 3 },
      { sender: 'user', content: "Hello! Yes, we absolutely do. That specific permit is for a 3,200 sq ft modern farmhouse design. I can send you the PDF brochure. What is your email address?", delayDays: 2 },
      { sender: 'lead', content: "Great! My email is lead@example.com. My budget is around $900k, would that fit this plan?", delayDays: 2 },
      { sender: 'user', content: "Yes, $900k is a great starting point for this layout depending on the finishes. I just sent the brochure to your email. Let's schedule a site visit for this Saturday?", delayDays: 1 },
      { sender: 'lead', content: "Saturday morning works for me. Around 10:00 AM?", delayDays: 1 }
    ],
    [
      { sender: 'lead', content: "Hello, I am interested in building a home on a 2-acre lot I own in Lakeway. Do you build in that area?", delayDays: 4 },
      { sender: 'user', content: "Hi! Yes, we build custom homes throughout Lakeway and the greater Austin area. We've actually completed three builds near Lakeway Blvd recently.", delayDays: 3 },
      { sender: 'lead', content: "Excellent. I'd love to know what your current cost per square foot is, and if you offer design-build services.", delayDays: 2 },
      { sender: 'user', content: "We are a full design-build firm, meaning we handle everything from architecture to interior design and construction. Our custom builds typically range from $280 to $350 per sq ft depending on complexity.", delayDays: 1 },
      { sender: 'lead', content: "That fits our budget. Can we schedule a quick call to discuss?", delayDays: 0 }
    ],
    [
      { sender: 'lead', content: "Hey, do you do major luxury home renovations, or only new construction?", delayDays: 2 },
      { sender: 'user', content: "Hi! We focus primarily on new custom residential construction, but we do take on whole-home luxury renovations over $250k. What kind of project are you planning?", delayDays: 1 },
      { sender: 'lead', content: "It's a full studs-out renovation of a 1980s mid-century modern home in West Lake Hills. We want to add a pool and open up the main floor layout.", delayDays: 0 }
    ],
    [
      { sender: 'lead', content: "Hello, what is your typical timeline for a 4,000 sq ft custom home from permit to completion?", delayDays: 5 },
      { sender: 'user', content: "Hi! Typically, a 4,000 sq ft custom home takes about 10 to 12 months for construction once the permit is approved. The architectural design and engineering phase takes another 2-3 months beforehand.", delayDays: 4 },
      { sender: 'lead', content: "Got it. We are hoping to start construction in early fall. Do you have availability in your schedule?", delayDays: 3 },
      { sender: 'user', content: "Yes, we currently have two slots open for our Fall building queue. I'd love to schedule a consultation to review your lot and plans.", delayDays: 2 }
    ],
    [
      { sender: 'lead', content: "Hi! We're looking at a piece of land in Spicewood but aren't sure if it's buildable due to the slope. Do you do site evaluations before purchase?", delayDays: 1 },
      { sender: 'user', content: "Hello! Yes, we do complimentary site evaluations for prospective clients. We'll look at topography, utility access, and zoning requirements.", delayDays: 0 }
    ]
  ]

  // Clean old messages first
  await prisma.message.deleteMany({})

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    const chat = conversations[i % conversations.length]

    console.log(`Seeding chat for lead: ${lead.name}`)
    
    for (const msg of chat) {
      const msgDate = new Date()
      msgDate.setDate(msgDate.getDate() - msg.delayDays)

      await prisma.message.create({
        data: {
          leadId: lead.id,
          sender: msg.sender,
          content: msg.content,
          isRead: msg.sender === 'user' ? true : msg.delayDays > 0, // Old messages are read, newest might be unread
          createdAt: msgDate
        }
      })
    }
  }

  console.log("✅ Seeding complete!")
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
