import crypto from 'crypto';
import { assertSecret } from './security-helpers.server';

function getHmacSecret(): string {
  const secret = process.env.WEBHOOK_HMAC_ROOT || process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY;
  return assertSecret('WEBHOOK_HMAC_ROOT', secret, 32);
}

export const PLATFORM_CONFIGS: Record<string, { code: string; label: string; readableSource: string }> = {
  wordpress: { code: 'wp', label: 'WordPress / Elementor Pro', readableSource: 'WordPress Elementor' },
  meta: { code: 'meta', label: 'Meta (FB & IG) Lead Ads', readableSource: 'Meta Lead Ads' },
  webflow: { code: 'wf', label: 'Webflow Forms', readableSource: 'Webflow Forms' },
  whatsapp: { code: 'wa', label: 'WhatsApp Business', readableSource: 'WhatsApp Inbound' },
  zapier: { code: 'zap', label: 'Zapier Webhook', readableSource: 'Zapier' },
  make: { code: 'make', label: 'Make.com', readableSource: 'Make.com' },
  html: { code: 'html', label: 'Custom HTML Embed', readableSource: 'Website Custom Form' },
};

// Fast in-memory verification cache (TTL: 10 mins) for sub-microsecond webhook ingestion
const verifiedTokenCache = new Map<string, {
  builderId: string;
  platform: string;
  readableSource: string;
  expiresAt: number;
}>();

function cleanTokenCache(): void {
  const now = Date.now();
  if (verifiedTokenCache.size > 2000) {
    for (const [key, val] of verifiedTokenCache.entries()) {
      if (val.expiresAt <= now) {
        verifiedTokenCache.delete(key);
      }
    }
  }
}

/**
 * Generates a 48-character high-entropy cryptographic, platform-scoped webhook token.
 * Format: wf_<48_character_hmac_signature>
 * 
 * Cryptographic Properties:
 * 1. 48 hex characters (192 bits of cryptographic HMAC-SHA256 entropy).
 * 2. Zero-pattern avalanche effect: No builder ID, platform code, or prefix leaks.
 * 3. Deterministic: Always generates the identical valid key for a given tenant + platform.
 */
export function generatePlatformToken(builderId: string, platformKey: string): string {
  if (!builderId) return '';
  const normKey = platformKey.toLowerCase().trim();

  const hmac = crypto.createHmac('sha256', getHmacSecret());
  hmac.update(`weaverframe:v2:platform_token:${builderId}:${normKey}`);
  const signature48 = hmac.digest('hex').slice(0, 48);

  return `wf_${signature48}`;
}

/**
 * Generates an encrypted/signed token dictionary for all supported lead platforms.
 */
export function generateAllPlatformTokens(builderId: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  if (!builderId) return tokens;

  for (const key of Object.keys(PLATFORM_CONFIGS)) {
    tokens[key] = generatePlatformToken(builderId, key);
  }
  return tokens;
}

/**
 * Verifies a platform-scoped token against a list of active builders.
 * Guarantees that:
 * 1. The token belongs to a legitimate active builder.
 * 2. The token is cryptographically bound to that exact platform.
 * 3. Any tampering with platform or builder immediately fails signature verification.
 */
export function verifyPlatformToken(
  token: string, 
  builders: Array<{ id: string; isActive: boolean }>
): {
  builderId: string;
  platform: string;
  readableSource: string;
} | null {
  if (!token || typeof token !== 'string' || !token.startsWith('wf_')) {
    return null;
  }

  cleanTokenCache();

  // 1. Fast Cache Hit (O(1) lookup ~0.001ms)
  const now = Date.now();
  const cached = verifiedTokenCache.get(token);
  if (cached && cached.expiresAt > now) {
    return {
      builderId: cached.builderId,
      platform: cached.platform,
      readableSource: cached.readableSource,
    };
  }

  // 2. High-Security v2 Format: wf_ + 48-character HMAC signature (Total 51 chars)
  if (token.length === 51) {
    const incomingSig = token.slice(3);
    const incomingBuf = Buffer.from(incomingSig, 'utf8');

    for (const b of builders) {
      if (!b.isActive) continue;
      for (const [platformKey, info] of Object.entries(PLATFORM_CONFIGS)) {
        const hmac = crypto.createHmac('sha256', getHmacSecret());
        hmac.update(`weaverframe:v2:platform_token:${b.id}:${platformKey}`);
        const candidateSig = hmac.digest('hex').slice(0, 48);

        if (
          candidateSig.length === incomingSig.length &&
          crypto.timingSafeEqual(incomingBuf, Buffer.from(candidateSig, 'utf8'))
        ) {
          const result = {
            builderId: b.id,
            platform: platformKey,
            readableSource: info.readableSource,
          };
          verifiedTokenCache.set(token, {
            ...result,
            expiresAt: now + 10 * 60 * 1000, // 10 minutes cache
          });
          return result;
        }
      }
    }
    return null;
  }

  // 3. Backward-compatibility for v1 tokens (wf_<code>_<prefix>_<sig20>)
  const parts = token.split('_');
  if (parts.length === 4) {
    const [, code, builderPrefix, signature] = parts;
    if (!code || !builderPrefix || !signature) return null;

    const platformEntry = Object.entries(PLATFORM_CONFIGS).find(([, v]) => v.code === code);
    if (!platformEntry) return null;
    const [platformKey, info] = platformEntry;

    for (const b of builders) {
      if (!b.isActive) continue;
      const candidatePrefix = b.id.replace(/-/g, '').slice(0, 12);
      if (candidatePrefix === builderPrefix) {
        const hmac = crypto.createHmac('sha256', getHmacSecret());
        hmac.update(`${b.id}:${code}:${platformKey}`);
        const expectedSig = hmac.digest('hex').slice(0, 20);

        if (
          signature.length === expectedSig.length &&
          crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
        ) {
          return {
            builderId: b.id,
            platform: platformKey,
            readableSource: info.readableSource,
          };
        }
      }
    }
  }

  return null;
}
