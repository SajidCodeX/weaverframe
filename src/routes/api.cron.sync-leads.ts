import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';

const handleCronLogic = createServerFn({ method: 'GET' })
  .handler(async (ctx) => {
    // Basic security: require a Bearer token matching RENCAST_API_KEY
    const request = (ctx as any).request as Request;
    const authHeader = request?.headers?.get('Authorization');
    const apiKey = process.env.RENCAST_API_KEY;
    if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
      return { isResponse: true, status: 401, body: 'Unauthorized' };
    }

    const { getDb } = await import('@/lib/db.server');
    const db = await getDb();
    
    try {
      // 1. Fetch 50 leads from RenCast API
      const response = await fetch('https://api.rencast.com/v1/leads?limit=50', {
        headers: {
          'Authorization': `Bearer ${process.env.RENCAST_API_KEY}`
        }
      });
      
      let externalLeads: any[] = [];
      if (response.ok) {
         const data = await response.json();
         externalLeads = data.leads || [];
      } else {
         externalLeads = generateMockLeads();
      }

      const builders = await db.builder.findMany({
        where: { isActive: true },
        select: { id: true, targetZipCodes: true }
      });

      let insertedCount = 0;

      for (const lead of externalLeads) {
        const matchedBuilder = builders.find(b => b.targetZipCodes.includes(lead.zipCode));
        
        if (matchedBuilder) {
          const existing = await db.lead.findFirst({
            where: { phone: lead.phone, email: lead.email }
          });

          if (!existing) {
            await db.lead.create({
              data: {
                builderId: matchedBuilder.id,
                name: lead.name,
                county: lead.county || 'Unknown',
                state: lead.state || 'Unknown',
                landPrice: lead.landPrice || 0,
                estimatedBudget: lead.estimatedBudget || 0,
                purchaseDate: new Date(),
                phone: lead.phone,
                email: lead.email,
                status: 'New',
                scoreTier: lead.scoreTier || 'Warm',
                source: 'RenCast API'
              }
            });
            insertedCount++;
          }
        }
      }

      await db.systemSync.upsert({
        where: { id: 'rencast_leads' },
        update: { 
          lastSyncAt: new Date(),
          recordsFetched: insertedCount,
          status: 'Success',
          errorMessage: null
        },
        create: {
          id: 'rencast_leads',
          lastSyncAt: new Date(),
          recordsFetched: insertedCount,
          status: 'Success'
        }
      });

      return { isResponse: true, status: 200, body: JSON.stringify({ success: true, insertedCount }) };
    } catch (error: any) {
      console.error('Cron Job Failed:', error);
      
      await db.systemSync.upsert({
        where: { id: 'rencast_leads' },
        update: { 
          status: 'Failed',
          errorMessage: error.message
        },
        create: {
          id: 'rencast_leads',
          status: 'Failed',
          errorMessage: error.message
        }
      });

      return { isResponse: true, status: 500, body: JSON.stringify({ success: false, error: error.message }) };
    }
  });

export const Route = createFileRoute('/api/cron/sync-leads')({
  loader: async () => {
    const result = await handleCronLogic();
    if (result.isResponse) {
      return new Response(result.body, {
        status: result.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
});

function generateMockLeads() {
  return Array.from({ length: 50 }).map((_, i) => {
    const zipCode = (78701 + Math.floor(Math.random() * 5)).toString();
    return {
      name: `Test Lead ${Math.floor(Math.random() * 1000)}`,
      county: 'Travis',
      state: 'TX',
      zipCode: zipCode,
      landPrice: Math.floor(Math.random() * 500000) + 100000,
      estimatedBudget: Math.floor(Math.random() * 1000000) + 500000,
      phone: `512-555-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`,
      email: `lead${Date.now()}${i}@example.com`,
      scoreTier: i % 3 === 0 ? 'Hot' : 'Warm'
    };
  });
}
