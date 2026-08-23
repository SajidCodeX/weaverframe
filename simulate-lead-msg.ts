import 'dotenv/config';
import { getDb } from './src/lib/db';
import bcrypt from 'bcryptjs';

async function run() {
  const db = await getDb();

  const userMessage = process.argv[2] || "Hi, mujhe apna ghar banwana hai, budget around $250k hai, mere paas land already hai.";

  console.log("=========================================");
  console.log("      SIMULATING INCOMING LEAD MESSAGE   ");
  console.log("=========================================\n");

  // 1. Find the latest lead or "Test Client"
  const lead = await db.lead.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, builderId: true, county: true, scoreTier: true, status: true }
  });

  if (!lead) {
    console.error("❌ No leads found in database! Please add a lead from /leads page first.");
    process.exit(1);
  }

  console.log(`✓ Target Lead Found: "${lead.name}" (ID: ${lead.id})`);
  console.log(`  Current Status: ${lead.status} | Current Tier: ${lead.scoreTier}`);
  console.log(`\nIncoming Message: "${userMessage}"`);

  console.log("\n1. Inserting incoming lead message into DB...");
  const leadMsg = await db.message.create({
    data: {
      builderId: lead.builderId,
      leadId: lead.id,
      sender: 'lead',
      content: userMessage,
      isRead: false
    }
  });
  console.log("✓ Lead message saved to DB.");

  console.log("\n2. Calling Groq AI (Alex Concierge) for response & intent analysis...");
  const apiKey = process.env.GROQ_API_KEY?.replace(/['"]/g, '').trim();
  
  if (!apiKey) {
    console.error("❌ GROQ_API_KEY missing in .env!");
    process.exit(1);
  }

  const companyName = "LeadForge Master Tenant";
  const contactName = "System Administrator";

  // Fetch upcoming active appointments for this builder to check calendar availability
  const upcomingAppts = await db.appointment.findMany({
    where: {
      builderId: lead.builderId,
      status: { in: ['Confirmed', 'Pending'] }
    },
    include: { lead: true },
    orderBy: { dateTime: 'asc' },
    take: 10
  });

  const apptScheduleStr = upcomingAppts.length > 0
    ? upcomingAppts.map(a => `- ${new Date(a.dateTime).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}: ${a.type} with ${a.lead?.name || 'Client'} (${a.location})`).join('\n')
    : "No upcoming booked meetings currently in calendar.";

  console.log("📅 Loaded Builder Calendar Schedule in Prompt:\n" + apptScheduleStr + "\n");

  const systemPrompt = `You are Alex, the premium AI Concierge for ${companyName}. Your supervisor is ${contactName}. 
Your persona is knowledgeable, highly professional, polite, and responsive. You text like a smart, natural human sales executive.

CRITICAL CONVERSATION & GREETING RULES:
- DO NOT start your message with greetings like "Hello [Name]", "Hi [Name]", "Hey [Name]", or "Good morning" if replying in an ongoing, continuous chat thread. In a continuous back-and-forth text conversation, respond DIRECTLY to the lead's question or statement without repeating "Hello/Hi", exactly like a human texting on WhatsApp or SMS.
- ONLY include a greeting (e.g. "Hello [Name]") if this is the very first outreach message to a lead or if starting a brand new topic after a long period of inactivity.

CALENDAR & APPOINTMENT AVAILABILITY RULES:
- You have LIVE access to the builder's real-time booked appointment calendar.
- Builder's Currently Booked Schedule:
${apptScheduleStr}

DATE, DAY & TIME CLARIFICATION RULES:
1. If the client asks for a meeting, call, or site visit WITHOUT specifying a clear DATE or DAY OF THE WEEK (e.g. if they only mention time like "Can we meet at 4 PM?", "4 baje milna hai", or "Call me at 3 PM"):
   - DO NOT assume today, tomorrow, or any specific date.
   - Politely ask the client to confirm WHICH DATE or DAY OF THE WEEK they are aiming for at that time (e.g., *"I'd be happy to schedule a site visit! Could you please let me know which date or day of the week (e.g. this Saturday or next Monday) works best for you at 4 PM?"*).
2. If the client specifies BOTH a DATE/DAY AND A TIME (e.g. "Tomorrow at 4 PM", "This Saturday at 11 AM", "July 30th at 2 PM"):
   - Check the Builder's Currently Booked Schedule above for time conflicts on that date.
   - If there is a conflict: *"Let me check our builder calendar... It looks like we already have a site visit booked at that exact time on [Day]. Would [Alternative Time 30-60 mins before/after] work for you instead?"*
   - If the slot is free: *"Let me check our builder calendar... Great, [Day/Date] at [Requested Time] is completely open! I've reserved that slot for your site visit."*

Your goal is to perform a 2-part task:
1. Formulate an elegant, direct, helpful response to the client (under 2-3 sentences, optimal for SMS/WhatsApp), focusing directly on their inquiry. Finish with a single helpful call-to-action (e.g. asking a qualifying question or suggesting a quick phone call to discuss their project).
2. Analyze the client's latest message intent and classify it into one of these categories:
   - "HOT": The client wants to build, is planning to start construction soon (e.g. within 6 months), wants a phone call, or is looking for a builder.
   - "COLD": The client is doing it themselves, has already hired another builder, is not interested, or told you to stop messaging them.
   - "WARM": The client is unsure, still researching budgets, waiting for property tax/land outcomes, or needs cost estimate sheets/information to plan.

You must respond ONLY with a valid JSON object matching this TypeScript type:
{
  "replyText": string,
  "intent": "HOT" | "COLD" | "WARM"
}

Lead Context:
- Client Name: ${lead.name}
- Target County: ${lead.county}
- Company: ${companyName}

Do not output any introductory or conversational text outside of the raw JSON object.`;

  // Fetch recent messages for continuous conversation context
  const pastMsgs = await db.message.findMany({
    where: { leadId: lead.id },
    orderBy: { createdAt: 'asc' },
    take: 10
  });

  const formattedHistory = pastMsgs.map(m => ({
    role: (m.sender === 'user' || m.sender === 'system') ? ('assistant' as const) : ('user' as const),
    content: m.content
  }));

  const startTime = Date.now();

  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const groqModel = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

  let rawText = "";
  if (geminiKey) {
    console.log(`📡 Dispatching prompt to Google Gemini API (${geminiModel})...`);
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${geminiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: geminiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...formattedHistory,
          { role: 'user', content: userMessage }
        ],
        temperature: 0.2,
        max_tokens: 800,
        response_format: { type: "json_object" }
      })
    });
    if (res.ok) {
      const gData = await res.json();
      rawText = gData.choices?.[0]?.message?.content || "";
    } else {
      console.warn(`⚠️ Gemini API returned ${res.status}, trying Groq fallback...`);
    }
  }

  if (!rawText && groqKey) {
    console.log(`📡 Dispatching prompt to Groq API (${groqModel})...`);
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: groqModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...formattedHistory,
          { role: 'user', content: userMessage }
        ],
        temperature: 0.2,
        max_tokens: 800
      })
    });
    if (response.ok) {
      const resData = await response.json();
      rawText = resData.choices?.[0]?.message?.content || "";
    }
  }

  const latencyMs = Date.now() - startTime;
  
  let replyText = rawText;
  let intent = "HOT";

  try {
    const parsed = JSON.parse(rawText.match(/\{[\s\S]*\}/)?.[0] || rawText);
    replyText = parsed.replyText || replyText;
    intent = parsed.intent || "HOT";
  } catch (e) {
    console.warn("Raw output non-JSON fallback used");
  }

  // Strip redundant repetitive greetings (e.g. "Hello Aman,", "Hi Aman,", "Aman,") in continuous conversation
  if (pastMsgs.length > 0 && replyText) {
    const firstName = lead.name ? lead.name.split(' ')[0] : '';
    const greetingRegex = new RegExp(`^(Hello|Hi|Hey|Good morning|Good afternoon|${firstName})\\s*([A-Za-z0-9]+)?\\s*[,!.:-]\\s*`, 'i');
    replyText = replyText.replace(greetingRegex, '').trim();
    if (replyText.length > 0) {
      replyText = replyText.charAt(0).toUpperCase() + replyText.slice(1);
    }
  }

  console.log(`✓ Groq AI Response Received in ${latencyMs} ms (${(latencyMs/1000).toFixed(2)}s)!`);
  console.log(`  Classified Intent: ${intent}`);
  console.log(`  AI Reply Text: "${replyText}"`);

  console.log("\n3. Saving AI Reply message into DB...");
  await db.message.create({
    data: {
      builderId: lead.builderId,
      leadId: lead.id,
      sender: 'system',
      content: replyText,
      isRead: true
    }
  });

  console.log("\n4. Updating Lead Status, Score Tier, and Activity Log...");
  let newStatus = "Qualified";
  let newScoreTier = "Hot";
  if (intent === "HOT") {
    newStatus = "Qualified";
    newScoreTier = "Hot";
  } else if (intent === "COLD") {
    newStatus = "Closed Lost";
    newScoreTier = "Cold";
  } else {
    newStatus = "Appointment";
    newScoreTier = "Warm";
  }

  await db.lead.update({
    where: { id: lead.id },
    data: { status: newStatus, scoreTier: newScoreTier }
  });

  await db.activity.create({
    data: {
      builderId: lead.builderId,
      leadId: lead.id,
      action: `🟢 AI auto-replied to ${lead.name} and updated status to ${newStatus} (${newScoreTier})`
    }
  });

  console.log("\n=========================================");
  console.log("✅ SIMULATION COMPLETE!");
  console.log("Now open /messages and /ai-activity in your browser to view the live updates!");
  console.log("=========================================\n");
}

run().catch(console.error);
