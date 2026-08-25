/**
 * CRM Integration Server Engine
 * Real, production-grade connectors for HubSpot CRM & GoHighLevel (GHL)
 */

import { decrypt } from './crypto';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface LeadSyncData {
  id?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  county?: string | null;
  state?: string | null;
  estimatedBudget?: number | null;
  landPrice?: number | null;
  scoreTier?: string | null;
  status?: string | null;
  intent?: string | null;
  summary?: string | null;
}

export interface SyncResult {
  provider: 'hubspot' | 'ghl';
  success: boolean;
  externalId?: string;
  dealId?: string;
  message?: string;
  error?: string;
}

// ─── HUBSPOT CRM CONNECTOR ───────────────────────────────────────────────────

/**
 * Perform a live network handshake to verify a HubSpot Private App Access Token.
 * Pings the HubSpot CRM Contacts API to verify validity and scopes.
 */
export async function testHubSpotConnection(accessToken: string): Promise<{ success: boolean; portalId?: number }> {
  if (!accessToken || !accessToken.trim()) {
    throw new Error('Missing HubSpot Private App Access Token.');
  }

  const cleanToken = accessToken.trim();
  if (cleanToken === '••••••••••••••••') {
    return { success: true };
  }

  try {
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, portalId: data?.results?.[0]?.portalId };
    }

    const errBody = await response.json().catch(() => ({ message: response.statusText }));
    if (response.status === 401) {
      throw new Error(`HubSpot Authentication Failed (401): Invalid or expired Private App Token. Please verify the token at HubSpot Settings > Integrations > Private Apps.`);
    }
    if (response.status === 403) {
      throw new Error(`HubSpot Scope Permission Denied (403): Your Private App token is missing required scopes. Please grant 'crm.objects.contacts.read' and 'crm.objects.contacts.write' scopes in HubSpot.`);
    }

    throw new Error(`HubSpot API Error (${response.status}): ${errBody?.message || response.statusText}`);
  } catch (err: any) {
    if (err.name === 'AbortError' || err.message?.includes('fetch failed')) {
      throw new Error(`HubSpot Network Error: Unable to reach api.hubapi.com. Please check your network connection.`);
    }
    throw err;
  }
}

/**
 * Upsert a contact and create an associated deal in HubSpot CRM.
 */
export async function syncLeadToHubSpot(
  accessToken: string,
  lead: LeadSyncData,
  companyName: string = 'Custom Builder'
): Promise<SyncResult> {
  const cleanToken = accessToken.trim();
  if (!cleanToken || cleanToken === '••••••••••••••••') {
    return { provider: 'hubspot', success: false, error: 'Unusable HubSpot credentials' };
  }

  try {
    const nameParts = (lead.name || 'Valued Lead').trim().split(/\s+/);
    const firstname = nameParts[0] || 'Valued';
    const lastname = nameParts.slice(1).join(' ') || (lead.name ? '' : 'Lead');

    const properties: Record<string, string> = {
      firstname,
      lastname,
      lifecyclestage: lead.scoreTier === 'Hot' ? 'opportunity' : 'lead',
      hs_lead_status: lead.status === 'Qualified' ? 'QUALIFIED' : 'OPEN',
    };

    if (lead.email) properties.email = lead.email;
    if (lead.phone) properties.phone = lead.phone;
    if (lead.county) properties.city = lead.county;
    if (lead.state) properties.state = lead.state;

    // 1. Create or Search Contact in HubSpot
    let contactId: string | undefined;

    const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties }),
    });

    if (createRes.ok) {
      const created = await createRes.json();
      contactId = created.id;
    } else if (createRes.status === 409 && lead.email) {
      // Contact already exists — search by email to retrieve ID and update
      const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'email',
                  operator: 'EQ',
                  value: lead.email,
                },
              ],
            },
          ],
        }),
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        contactId = searchData.results?.[0]?.id;

        if (contactId) {
          // Update the existing contact
          await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${cleanToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ properties }),
          });
        }
      }
    } else {
      const errText = await createRes.text();
      return { provider: 'hubspot', success: false, error: `HubSpot contact creation failed (${createRes.status}): ${errText}` };
    }

    // 2. If lead has budget and contact exists, create a Deal in HubSpot
    let dealId: string | undefined;
    if (contactId && lead.estimatedBudget) {
      const dealProperties: Record<string, string> = {
        dealname: `Custom Home Build — ${lead.name || 'New Lead'} (${lead.county || 'Project'})`,
        amount: String(lead.estimatedBudget || 1500000),
        dealstage: lead.status === 'Qualified' ? 'qualifiedtobuy' : 'appointmentscheduled',
        pipeline: 'default',
      };

      const dealRes = await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: dealProperties,
          associations: [
            {
              to: { id: contactId },
              types: [
                {
                  associationCategory: 'HUBSPOT_DEFINED',
                  associationTypeId: 3, // Contact-to-Deal standard association
                },
              ],
            },
          ],
        }),
      });

      if (dealRes.ok) {
        const dealData = await dealRes.json();
        dealId = dealData.id;
      }
    }

    return {
      provider: 'hubspot',
      success: true,
      externalId: contactId,
      dealId,
      message: `Successfully synced contact ${contactId}${dealId ? ` & deal ${dealId}` : ''} to HubSpot CRM.`,
    };
  } catch (err: any) {
    console.error('[HUBSPOT SYNC ERROR]:', err);
    return { provider: 'hubspot', success: false, error: err.message || 'Unknown error' };
  }
}

// ─── GOHIGHLEVEL (GHL) CONNECTOR ─────────────────────────────────────────────

/**
 * Perform a live network handshake to verify a GoHighLevel (GHL) API Key or Location Token.
 * Supports both GHL v1 and GHL v2 (LeadConnector) API architectures.
 */
export async function testGhlConnection(apiKey: string, locationId?: string): Promise<{ success: boolean }> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Missing GoHighLevel Location API Key.');
  }

  const cleanKey = apiKey.trim();
  if (cleanKey === '••••••••••••••••') {
    return { success: true };
  }

  try {
    // Try GHL v2 LeadConnector API first
    const v2Headers: Record<string, string> = {
      'Authorization': `Bearer ${cleanKey}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json',
    };
    if (locationId) v2Headers['Channel'] = 'OAUTH';

    const testUrl = locationId
      ? `https://services.leadconnectorhq.com/locations/${locationId}/customFields`
      : `https://services.leadconnectorhq.com/users/search?limit=1`;

    const v2Res = await fetch(testUrl, {
      method: 'GET',
      headers: v2Headers,
    });

    if (v2Res.ok) {
      return { success: true };
    }

    // Fallback: Check GHL v1 API
    const v1Res = await fetch('https://rest.gohighlevel.com/v1/custom-fields/', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
      },
    });

    if (v1Res.ok) {
      return { success: true };
    }

    if (v2Res.status === 401 || v1Res.status === 401) {
      throw new Error(`GoHighLevel Authentication Failed (401): Invalid or unauthorized GHL Location API Key. Please verify your API Key in GHL Sub-Account Settings > Business Profile > API Key.`);
    }

    if (v2Res.status === 403 || v1Res.status === 403) {
      throw new Error(`GoHighLevel Scope Denied (403): The API Key lacks permissions for contacts or custom fields.`);
    }

    throw new Error(`GoHighLevel API Error: Authorization rejected (${v2Res.status || v1Res.status}).`);
  } catch (err: any) {
    if (err.name === 'AbortError' || err.message?.includes('fetch failed')) {
      throw new Error(`GoHighLevel Network Error: Unable to reach GHL endpoints.`);
    }
    throw err;
  }
}

/**
 * Upsert a contact into GoHighLevel with custom tags and custom fields.
 */
export async function syncLeadToGoHighLevel(
  apiKey: string,
  lead: LeadSyncData,
  companyName: string = 'Custom Builder'
): Promise<SyncResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey || cleanKey === '••••••••••••••••') {
    return { provider: 'ghl', success: false, error: 'Unusable GHL credentials' };
  }

  try {
    const nameParts = (lead.name || 'Valued Lead').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Valued';
    const lastName = nameParts.slice(1).join(' ') || (lead.name ? '' : 'Lead');

    const tags = ['WeaverFrame-Lead'];
    if (lead.scoreTier === 'Hot') tags.push('AI-Hot-Lead');
    if (lead.status === 'Qualified') tags.push('AI-Qualified');

    const payload = {
      firstName,
      lastName,
      name: lead.name || `${firstName} ${lastName}`,
      email: lead.email || undefined,
      phone: lead.phone || undefined,
      city: lead.county || undefined,
      state: lead.state || undefined,
      tags,
      source: 'WeaverFrame AI Concierge',
      customFields: [
        { key: 'estimated_budget', value: lead.estimatedBudget ? `$${lead.estimatedBudget.toLocaleString()}` : '' },
        { key: 'ai_intent', value: lead.intent || 'Qualified Inquiry' },
        { key: 'ai_score_tier', value: lead.scoreTier || 'Warm' },
      ],
    };

    // 1. Try upserting via GHL v2 API
    const v2Res = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (v2Res.ok) {
      const data = await v2Res.json();
      return {
        provider: 'ghl',
        success: true,
        externalId: data.contact?.id || data.id,
        message: `Successfully synced lead to GoHighLevel (GHL Contact ID: ${data.contact?.id || data.id}).`,
      };
    }

    // 2. Fallback to GHL v1 API
    const v1Res = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (v1Res.ok) {
      const data = await v1Res.json();
      return {
        provider: 'ghl',
        success: true,
        externalId: data.contact?.id || data.id,
        message: `Successfully synced lead to GoHighLevel v1 (GHL Contact ID: ${data.contact?.id || data.id}).`,
      };
    }

    const errText = await v2Res.text();
    return { provider: 'ghl', success: false, error: `GHL contact sync failed (${v2Res.status}): ${errText}` };
  } catch (err: any) {
    console.error('[GHL SYNC ERROR]:', err);
    return { provider: 'ghl', success: false, error: err.message || 'Unknown error' };
  }
}

// ─── MULTI-CRM SYNC ORCHESTRATOR ─────────────────────────────────────────────

/**
 * Dispatch parallel synchronization to all active CRMs configured for a builder.
 */
export async function syncLeadToConnectedCrms(
  builderId: string,
  lead: LeadSyncData,
  companyName: string = 'Custom Builder'
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  if (!builderId) return results;

  try {
    const { db } = await import('@/lib/db');
    const integrations = await db.integration.findMany({
      where: {
        builderId,
        isConnected: true,
        platformId: { in: ['hubspot', 'ghl'] },
      },
    });

    if (!integrations || integrations.length === 0) {
      return results;
    }

    const syncPromises = integrations.map(async (row) => {
      try {
        if (!row.configSecure) return null;
        const creds = JSON.parse(decrypt(row.configSecure));

        if (row.platformId === 'hubspot' && creds.accessToken) {
          const res = await syncLeadToHubSpot(creds.accessToken, lead, companyName);
          if (res.success && lead.id) {
            await db.activity.create({
              data: {
                builderId,
                leadId: lead.id,
                action: `🔄 Lead & Deal synced to HubSpot CRM (ID: ${res.externalId || 'OK'})`,
              },
            }).catch(() => {});
          }
          return res;
        }

        if (row.platformId === 'ghl' && creds.apiKey) {
          const res = await syncLeadToGoHighLevel(creds.apiKey, lead, companyName);
          if (res.success && lead.id) {
            await db.activity.create({
              data: {
                builderId,
                leadId: lead.id,
                action: `🔄 Contact & Tags synced to GoHighLevel (ID: ${res.externalId || 'OK'})`,
              },
            }).catch(() => {});
          }
          return res;
        }
      } catch (syncErr: any) {
        console.error(`[CRM DISPATCH ERROR for ${row.platformId}]:`, syncErr);
        return {
          provider: row.platformId as any,
          success: false,
          error: syncErr.message,
        };
      }
      return null;
    });

    const settled = await Promise.all(syncPromises);
    for (const r of settled) {
      if (r) results.push(r);
    }
  } catch (err) {
    console.error('[MULTI-CRM SYNC ORCHESTRATOR ERROR]:', err);
  }

  return results;
}
