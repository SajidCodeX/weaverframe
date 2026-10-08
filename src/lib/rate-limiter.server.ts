import net from 'node:net';
import crypto from 'node:crypto';

// ── In-Memory Sliding Window Store (Serverless Local / Fallback Engine) ──────
interface RateLimitRecord {
  timestamps: number[];
  lockedUntil?: number;
}

const localStore = new Map<string, RateLimitRecord>();

// Cleanup stale entries every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of localStore.entries()) {
      if (record.lockedUntil && record.lockedUntil <= now) {
        record.lockedUntil = undefined;
      }
      record.timestamps = record.timestamps.filter((ts) => now - ts < 3600000);
      if (record.timestamps.length === 0 && !record.lockedUntil) {
        localStore.delete(key);
      }
    }
  }, 10 * 60 * 1000).unref?.();
}

/**
 * Resets local limiter state (primarily for test harness isolation).
 */
export function resetRateLimiterState(): void {
  localStore.clear();
}

/**
 * Extracts and strictly validates client IP from request headers (Finding 1.2).
 * Prevents X-Forwarded-For client spoofing attacks by honoring trusted deployment headers.
 * Never bundles unknown callers into a shared 127.0.0.1 bucket.
 */
export function getClientIp(
  requestOrHeaders?: Request | Headers | Record<string, string | string[] | undefined> | null
): string {
  if (!requestOrHeaders) {
    return 'anon:' + crypto.randomBytes(8).toString('hex');
  }

  const getHeader = (name: string): string | null => {
    const lower = name.toLowerCase();
    const target = requestOrHeaders as any;
    if (target && target.headers && typeof target.headers.get === 'function') {
      return target.headers.get(lower);
    }
    if (target && typeof target.get === 'function') {
      return target.get(lower);
    }
    if (typeof target === 'object' && target !== null) {
      const val = target[lower] ?? target[name];
      if (Array.isArray(val)) return val[0] || null;
      return typeof val === 'string' ? val : null;
    }
    return null;
  };

  const validateIp = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    const candidate = raw.trim();
    if (net.isIP(candidate)) {
      return candidate;
    }
    return null;
  };

  // 1. Explicit deployment-configured header (e.g., behind corporate proxy or custom ingress)
  const trustedHeaderName = process.env.TRUSTED_IP_HEADER;
  if (trustedHeaderName) {
    const configuredVal = getHeader(trustedHeaderName);
    const validated = validateIp(configuredVal);
    if (validated) return validated;
  }

  // 2. Cloudflare Connecting IP (set by Cloudflare edge proxy, tamper-proof on CF)
  const cfIp = validateIp(getHeader('cf-connecting-ip'));
  if (cfIp) return cfIp;

  // 3. Vercel Forwarded For (set by Vercel edge infrastructure)
  const vercelIp = validateIp(getHeader('x-vercel-forwarded-for'));
  if (vercelIp) return vercelIp;

  // 4. Standard Nginx / Reverse Proxy Real IP
  const realIp = validateIp(getHeader('x-real-ip'));
  if (realIp) return realIp;

  // 5. X-Forwarded-For (extract leftmost valid IP, or rightmost valid if proxy chains)
  const xff = getHeader('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim());
    for (const part of parts) {
      const valid = validateIp(part);
      if (valid) return valid;
    }
  }

  // 6. Isolated Bucket for Unknown IPs:
  // NEVER return 127.0.0.1 or a static bucket that pools all users together!
  const ua = getHeader('user-agent') || '';
  const acceptLang = getHeader('accept-language') || '';
  const hash = crypto
    .createHash('sha256')
    .update(`${ua}:${acceptLang}`)
    .digest('hex')
    .slice(0, 16);

  return `anon:${hash}`;
}

// ── Generic Sliding Window Rate Limiter Engine ───────────────────────────────
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

export async function checkRateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
  increment?: boolean;
}): Promise<RateLimitResult> {
  const { key, limit, windowMs, increment = true } = opts;
  const now = Date.now();

  // 1. Check Upstash Redis if configured
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const { Redis } = await import('@upstash/redis');
      const { Ratelimit } = await import('@upstash/ratelimit');

      const redis = new Redis({ url: redisUrl, token: redisToken });
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${Math.ceil(windowMs / 1000)} s` as any),
        prefix: 'wf:rl',
      });

      if (increment) {
        const res = await ratelimit.limit(key);
        return {
          success: res.success,
          limit: res.limit,
          remaining: res.remaining,
          resetMs: res.reset - now,
        };
      } else {
        const remaining = await ratelimit.getRemaining(key);
        return {
          success: remaining.remaining > 0,
          limit,
          remaining: remaining.remaining,
          resetMs: remaining.reset - now,
        };
      }
    } catch (redisErr) {
      console.warn('[RATE-LIMITER] Upstash Redis error, falling back to in-memory store:', redisErr);
      // Fall through to resilient local engine
    }
  }

  // 2. In-Memory Sliding Window Engine
  let record = localStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    localStore.set(key, record);
  }

  // Prune timestamps older than windowMs
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  // Check lockout
  if (record.lockedUntil) {
    if (now < record.lockedUntil) {
      return {
        success: false,
        limit,
        remaining: 0,
        resetMs: record.lockedUntil - now,
      };
    } else {
      record.lockedUntil = undefined;
    }
  }

  const currentCount = record.timestamps.length;
  if (currentCount >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      resetMs: windowMs - (now - (record.timestamps[0] || now)),
    };
  }

  if (increment) {
    record.timestamps.push(now);
  }

  return {
    success: true,
    limit,
    remaining: limit - record.timestamps.length,
    resetMs: windowMs,
  };
}

// ── Login Rate Limiter (Finding 1.2) ──────────────────────────────────────────
// Rule: Counts FAILURES ONLY. Does not consume limits on successful logins.
// Lockout thresholds:
//   - (email, IP) pair: 5 failed attempts per 15 mins -> 15-min lockout
//   - Per-email global: 10 failed attempts per 15 mins -> 15-min lockout (protects against distributed brute-force)
//   - Per-IP global: 30 failed attempts per 15 mins -> 15-min lockout (protects against credential stuffing)

const LOGIN_PAIR_LIMIT = 5;
const LOGIN_EMAIL_GLOBAL_LIMIT = 10;
const LOGIN_IP_GLOBAL_LIMIT = 30;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function checkLoginRateLimit(email: string, ip: string): Promise<void> {
  const normEmail = email.toLowerCase().trim();
  const pairKey = `login:pair:${normEmail}:${ip}`;
  const emailKey = `login:email:${normEmail}`;
  const ipKey = `login:ip:${ip}`;

  // Check pair lockout
  const pairRecord = localStore.get(pairKey);
  const now = Date.now();
  if (pairRecord?.lockedUntil && now < pairRecord.lockedUntil) {
    const mins = Math.ceil((pairRecord.lockedUntil - now) / 60000);
    throw new Error(
      `Too many failed login attempts. Your account access has been temporarily locked. Please try again in ${mins} minute${mins !== 1 ? 's' : ''}.`
    );
  }

  // Check email global lockout
  const emailRecord = localStore.get(emailKey);
  if (emailRecord?.lockedUntil && now < emailRecord.lockedUntil) {
    const mins = Math.ceil((emailRecord.lockedUntil - now) / 60000);
    throw new Error(
      `Too many failed login attempts for this account across multiple locations. Account locked for security. Please try again in ${mins} minute${mins !== 1 ? 's' : ''}.`
    );
  }

  // Check IP global lockout
  const ipRecord = localStore.get(ipKey);
  if (ipRecord?.lockedUntil && now < ipRecord.lockedUntil) {
    const mins = Math.ceil((ipRecord.lockedUntil - now) / 60000);
    throw new Error(
      `Too many failed login attempts from this network. Temporarily blocked for security. Please try again in ${mins} minute${mins !== 1 ? 's' : ''}.`
    );
  }
}

export async function recordFailedLogin(email: string, ip: string): Promise<void> {
  const normEmail = email.toLowerCase().trim();
  const pairKey = `login:pair:${normEmail}:${ip}`;
  const emailKey = `login:email:${normEmail}`;
  const ipKey = `login:ip:${ip}`;
  const now = Date.now();

  const recordAttempt = (key: string, limit: number): { count: number; locked: boolean } => {
    let rec = localStore.get(key);
    if (!rec) {
      rec = { timestamps: [] };
      localStore.set(key, rec);
    }
    rec.timestamps = rec.timestamps.filter((ts) => now - ts < LOGIN_WINDOW_MS);
    rec.timestamps.push(now);

    if (rec.timestamps.length >= limit) {
      rec.lockedUntil = now + LOGIN_WINDOW_MS;
      return { count: rec.timestamps.length, locked: true };
    }
    return { count: rec.timestamps.length, locked: false };
  };

  const pairResult = recordAttempt(pairKey, LOGIN_PAIR_LIMIT);
  const emailResult = recordAttempt(emailKey, LOGIN_EMAIL_GLOBAL_LIMIT);
  const ipResult = recordAttempt(ipKey, LOGIN_IP_GLOBAL_LIMIT);

  if (pairResult.locked || emailResult.locked || ipResult.locked) {
    throw new Error(
      `Too many failed login attempts. Your account access has been temporarily locked for 15 minutes for security.`
    );
  }

  const remaining = LOGIN_PAIR_LIMIT - pairResult.count;
  if (remaining <= 2) {
    throw new Error(
      `Invalid email or password. Warning: ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before account access is temporarily locked.`
    );
  }
}

export async function clearLoginAttempts(email: string, ip: string): Promise<void> {
  const normEmail = email.toLowerCase().trim();
  localStore.delete(`login:pair:${normEmail}:${ip}`);
  // Clear email failures on successful login
  localStore.delete(`login:email:${normEmail}`);
}

// ── Password Reset Rate Limiter (Finding 10.2) ───────────────────────────────
// Caps:
//   - Per-email: max 3 requests per 1 hour (prevents email bombing victims)
//   - Per-IP: max 10 requests per 1 hour (prevents spraying across multiple accounts)
const RESET_EMAIL_LIMIT = 3;
const RESET_IP_LIMIT = 10;
const RESET_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function checkPasswordResetRateLimit(email: string, ip: string): Promise<void> {
  const normEmail = email.toLowerCase().trim();
  const emailKey = `reset:email:${normEmail}`;
  const ipKey = `reset:ip:${ip}`;

  const emailRes = await checkRateLimit({
    key: emailKey,
    limit: RESET_EMAIL_LIMIT,
    windowMs: RESET_WINDOW_MS,
    increment: true,
  });

  if (!emailRes.success) {
    throw new Error(
      'Too many password reset requests for this email address. Please wait 1 hour before trying again.'
    );
  }

  const ipRes = await checkRateLimit({
    key: ipKey,
    limit: RESET_IP_LIMIT,
    windowMs: RESET_WINDOW_MS,
    increment: true,
  });

  if (!ipRes.success) {
    throw new Error(
      'Too many password reset requests from this network. Please wait 1 hour before trying again.'
    );
  }
}

// ── Public Forms & Webhook Rate Limiter (Finding 10.2) ───────────────────────
// Caps:
//   - Demo requests: 5 per 10 mins per IP
//   - Inbound webhook: 60 per minute per token+IP
//   - Review submissions: 10 per 15 mins per IP
export async function checkPublicFormRateLimit(
  type: 'demo' | 'inbound' | 'review',
  identifier: string
): Promise<void> {
  let limit: number;
  let windowMs: number;
  let formName: string;

  switch (type) {
    case 'demo':
      limit = 5;
      windowMs = 10 * 60 * 1000; // 10 minutes
      formName = 'demonstration request';
      break;
    case 'inbound':
      limit = 60;
      windowMs = 60 * 1000; // 1 minute
      formName = 'inbound lead submission';
      break;
    case 'review':
      limit = 10;
      windowMs = 15 * 60 * 1000; // 15 minutes
      formName = 'review feedback';
      break;
  }

  const key = `form:${type}:${identifier}`;
  const res = await checkRateLimit({ key, limit, windowMs, increment: true });

  if (!res.success) {
    throw new Error(
      `Too many ${formName} submissions. Rate limit reached. Please try again later.`
    );
  }
}
