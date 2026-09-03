import { getDb } from './db';
import { encrypt, decrypt } from './crypto';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiryDate: number; // Epoch timestamp (ms)
  email: string;
  name?: string;
  picture?: string;
  provider: 'google_oauth';
}

/**
 * Resolves Google OAuth 2.0 Client credentials from environment variables.
 */
export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const base = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${base}/api/auth/google/callback`;

  return { clientId, clientSecret, redirectUri };
}

/**
 * Generates the Google OAuth 2.0 consent screen URL.
 * Requests offline access (refresh token) and Gmail read/send scopes.
 */
export function generateGoogleAuthUrl(builderId: string, returnTo: string = '/settings?tab=integrations'): { url: string; state: string } {
  const config = getGoogleOAuthConfig();

  if (!config.clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured in environment variables.');
  }

  const statePayload = JSON.stringify({
    builderId,
    returnTo,
    ts: Date.now(),
    nonce: Math.random().toString(36).substring(2, 15)
  });

  const state = Buffer.from(statePayload).toString('base64url');

  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly'
  ];

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline', // Mandatory for refresh_token
    prompt: 'consent',     // Ensures refresh_token is returned even on re-connection
    include_granted_scopes: 'true',
    state
  });

  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    state
  };
}

/**
 * Exchanges authorization code for Google access and refresh tokens.
 */
export async function exchangeGoogleAuthCode(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}> {
  const config = getGoogleOAuthConfig();

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code'
    }).toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[GOOGLE OAUTH] Token exchange failed:', errorText);
    throw new Error(`Google token exchange failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 3600
  };
}

/**
 * Retrieves the Google user's profile info (email and name).
 */
export async function getGoogleUserProfile(accessToken: string): Promise<{
  email: string;
  name: string;
  picture?: string;
}> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google user profile: ${response.statusText}`);
  }

  const profile = await response.json();
  return {
    email: profile.email,
    name: profile.name || profile.email,
    picture: profile.picture
  };
}

/**
 * Refreshes an expired Google access token using the stored refresh token.
 */
export async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const config = getGoogleOAuthConfig();

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token'
    }).toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[GOOGLE OAUTH] Token refresh failed:', errorText);
    throw new Error(`Google token refresh failed: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600
  };
}

/**
 * Loads the builder's stored Google OAuth integration, automatically refreshing
 * the access token if it has expired or is about to expire.
 */
export async function getValidGoogleAccessToken(builderId: string): Promise<{
  accessToken: string;
  email: string;
  name?: string;
} | null> {
  const db = await getDb();

  const integration = await db.integration.findFirst({
    where: {
      builderId,
      platformId: 'email_mailbox',
      isConnected: true
    }
  });

  if (!integration || !integration.configSecure) {
    return null;
  }

  let config: GoogleOAuthTokens;
  try {
    const decrypted = decrypt(integration.configSecure);
    config = JSON.parse(decrypted);
  } catch {
    return null;
  }

  if (config.provider !== 'google_oauth' || !config.accessToken) {
    return null;
  }

  const now = Date.now();
  // Refresh if token expires in less than 2 minutes (120,000 ms)
  const isExpiring = !config.expiryDate || config.expiryDate - now < 120000;

  if (isExpiring && config.refreshToken) {
    try {
      console.log(`[GOOGLE OAUTH] Access token expired or expiring for builder ${builderId}. Refreshing...`);
      const refreshed = await refreshGoogleAccessToken(config.refreshToken);
      const newExpiry = Date.now() + (refreshed.expiresIn * 1000);

      config.accessToken = refreshed.accessToken;
      config.expiryDate = newExpiry;

      // Update database securely
      const encrypted = encrypt(JSON.stringify(config));
      await db.integration.update({
        where: { id: integration.id },
        data: { configSecure: encrypted }
      });

      return {
        accessToken: config.accessToken,
        email: config.email,
        name: config.name
      };
    } catch (refreshErr) {
      console.error('[GOOGLE OAUTH] Automatic token refresh error:', refreshErr);
      // If refresh failed, still return existing token in case it still has valid seconds
      return {
        accessToken: config.accessToken,
        email: config.email,
        name: config.name
      };
    }
  }

  return {
    accessToken: config.accessToken,
    email: config.email,
    name: config.name
  };
}

/**
 * Dispatches an outbound email directly using the official Gmail REST API.
 * Serverless-optimized: Uses HTTPS fetch with zero raw TCP socket overhead.
 */
export async function sendGmailViaRestApi(
  accessToken: string,
  options: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
    replyTo?: string;
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
    const fromAddress = options.from || 'me';
    const utf8Subject = `=?utf-8?B?${Buffer.from(options.subject).toString('base64')}?=`;

    const bodyContent = options.html || options.text || '';
    const contentType = options.html ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';

    const headers = [
      `From: ${fromAddress}`,
      `To: ${recipients}`,
      ...(options.replyTo ? [`Reply-To: ${options.replyTo}`] : []),
      `Subject: ${utf8Subject}`,
      'MIME-Version: 1.0',
      `Content-Type: ${contentType}`,
      'Content-Transfer-Encoding: 7bit',
      '',
      bodyContent
    ];

    const rawMessage = headers.join('\r\n');
    const base64UrlMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: base64UrlMessage })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GMAIL API ERROR] Failed to send email:', errorText);
      return { success: false, error: `Gmail API error: ${response.status} ${errorText}` };
    }

    const data = await response.json();
    console.log(`[GMAIL API] Email successfully sent via Gmail REST API (Message ID: ${data.id})`);
    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('[GMAIL API EXCEPTION]:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Inspects recent sent emails via Gmail REST API for human takeover detection.
 * Instant, serverless-friendly, and avoids IMAP TCP timeouts on Vercel.
 */
export async function fetchRecentGmailSentMessages(
  accessToken: string,
  leadEmailMap: Map<string, any>
): Promise<Array<{ leadId: string; recipient: string; subject: string; snippet: string; date: Date }>> {
  try {
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:sent&maxResults=10',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listRes.ok) return [];

    const listData = await listRes.json();
    const messages = listData.messages || [];
    const matchedEvents: Array<{ leadId: string; recipient: string; subject: string; snippet: string; date: Date }> = [];

    for (const msg of messages) {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!detailRes.ok) continue;

      const detail = await detailRes.json();
      const headers = detail.payload?.headers || [];
      const toHeader = headers.find((h: any) => h.name.toLowerCase() === 'to')?.value || '';
      const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
      const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';

      const cleanTo = toHeader.toLowerCase().replace(/.*<([^>]+)>.*/, '$1').trim();

      if (cleanTo && leadEmailMap.has(cleanTo)) {
        const lead = leadEmailMap.get(cleanTo)!;
        matchedEvents.push({
          leadId: lead.id,
          recipient: cleanTo,
          subject: subjectHeader,
          snippet: detail.snippet || '',
          date: dateHeader ? new Date(dateHeader) : new Date()
        });
      }
    }

    return matchedEvents;
  } catch (err) {
    console.warn('[GMAIL API] Failed to fetch sent messages for takeover:', err);
    return [];
  }
}
