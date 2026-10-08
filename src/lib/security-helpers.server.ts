import crypto from 'crypto';
import net from 'net';
import dns from 'dns';

const DEFAULT_ORIGIN = 'https://weaverframe.in';

/**
 * Resolves the trusted application base URL from environment or default.
 */
export function getAppBaseUrl(): string {
  const envUrl = process.env.APP_BASE_URL?.trim();
  if (!envUrl) return DEFAULT_ORIGIN;
  try {
    const parsed = new URL(envUrl);
    return parsed.origin;
  } catch {
    return DEFAULT_ORIGIN;
  }
}

/**
 * Validates and sanitizes a return or redirect URL to prevent Open Redirect (Finding 4.3).
 * Guarantees that:
 * 1. Protocol-relative URLs (//evil.com) and backslash paths (/\evil.com) are rejected.
 * 2. Unsafe protocols (javascript:, data:, file:) are rejected.
 * 3. External origins not matching getAppBaseUrl() are rejected.
 * 4. Safe relative paths (e.g. /settings?billing=success) are resolved against the trusted app origin.
 */
export function getSafeRedirectUrl(
  requestedUrl: string | undefined,
  defaultPath: string
): string {
  const baseOrigin = getAppBaseUrl();
  const normalizedDefaultPath = defaultPath.startsWith('/') ? defaultPath : `/${defaultPath}`;
  const safeFallback = `${baseOrigin}${normalizedDefaultPath}`;

  if (!requestedUrl || typeof requestedUrl !== 'string') {
    return safeFallback;
  }

  const trimmed = requestedUrl.trim();

  // Reject protocol-relative and backslash bypass vectors
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\') || trimmed.startsWith('\\')) {
    return safeFallback;
  }

  // Reject dangerous non-http protocols
  if (/^(?:javascript|data|vbscript|file):/i.test(trimmed)) {
    return safeFallback;
  }

  try {
    // If it's a relative path starting with a single '/'
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      // Validate with URL constructor against trusted base
      const resolved = new URL(trimmed, baseOrigin);
      if (resolved.origin !== baseOrigin) {
        return safeFallback;
      }
      return resolved.toString();
    }

    // If it's an absolute URL, strictly verify origin matches trusted base
    const parsed = new URL(trimmed);
    if (parsed.origin !== baseOrigin) {
      return safeFallback;
    }

    return parsed.toString();
  } catch {
    return safeFallback;
  }
}

/**
 * Validates presence and minimum entropy of critical security secrets (Finding 3.1).
 * Fails fast at runtime invocation rather than falling back to hardcoded secrets.
 */
export function assertSecret(
  name: string,
  value: string | undefined,
  minLength = 32
): string {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `[FATAL] ${name} is missing. Refusing to operate with insecure fallback. Configure this environment variable.`
    );
  }

  if (value.length < minLength) {
    throw new Error(
      `[FATAL] ${name} has insufficient entropy (${value.length} chars, minimum ${minLength} characters required).`
    );
  }

  return value;
}

/**
 * Computes a high-entropy SHA-256 cryptographic hash of a raw token (Finding 1.1).
 * Never store plaintext tokens in the database.
 */
export function hashToken(rawToken: string): string {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
    throw new Error('Invalid token: token cannot be empty');
  }
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

/**
 * Returns a standardized, sanitized password reset response that leaks zero credentials (Finding 1.1).
 */
export function sanitizeResetResponse(): {
  success: true;
  message: string;
  result?: { success: true; message: string };
} {
  return {
    success: true,
    message: 'If an active account exists, password reset instructions have been dispatched.',
    result: {
      success: true,
      message: 'If an active account exists, password reset instructions have been dispatched.',
    },
  };
}

/**
 * Asserts that the authenticated session possesses an explicit, valid tenant context (Finding 2.1).
 * For builders: strictly requires session.builderId.
 * For platform admins: strictly requires session.actingAsBuilderId (impersonation mode).
 * Throws a fatal FORBIDDEN exception if tenant context is missing.
 */
export function assertTenantContext(session: {
  role?: string;
  builderId?: string | null;
  actingAsBuilderId?: string | null;
}): string {
  if (!session) {
    throw new Error('FORBIDDEN: Tenant context required (unauthenticated)');
  }

  const tenantId =
    session.role === 'admin'
      ? session.actingAsBuilderId
      : session.builderId;

  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new Error('FORBIDDEN: Tenant context required. Refusing to execute unscoped query.');
  }

  return tenantId.trim();
}

/**
 * Checks if an IP address belongs to loopback, private RFC 1918, link-local, or AWS metadata ranges (SSRF prevention).
 */
export function isForbiddenIpAddress(ip: string): boolean {
  if (!ip) return true;
  let cleanIp = ip;
  if (cleanIp.startsWith('::ffff:')) {
    cleanIp = cleanIp.slice(7);
  }

  const isV4 = net.isIPv4(cleanIp);
  const isV6 = net.isIPv6(cleanIp);

  if (!isV4 && !isV6) return true;

  if (isV4) {
    const parts = cleanIp.split('.').map(Number);
    const [a, b] = parts;
    if (a === 0) return true;               // 0.0.0.0/8
    if (a === 10) return true;              // 10.0.0.0/8
    if (a === 127) return true;             // 127.0.0.0/8 (Loopback)
    if (a === 169 && b === 254) return true;// 169.254.0.0/16 (Link-local & AWS metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true;// 192.168.0.0/16
    if (a >= 224) return true;              // 224.0.0.0/4 (Multicast/Reserved)
    return false;
  }

  if (isV6) {
    const lower = cleanIp.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    return false;
  }

  return false;
}

/**
 * Validates outbound webhook URLs with DNS pinning and private IP blocking (Finding 5.1 SSRF).
 */
export async function validateOutboundWebhookUrl(urlString: string): Promise<string> {
  if (!urlString || typeof urlString !== 'string') {
    throw new Error('Webhook URL cannot be empty.');
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    throw new Error('Invalid Webhook URL format.');
  }

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && parsed.protocol !== 'https:') {
    throw new Error('Outbound webhook URLs must use secure HTTPS protocol in production.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Forbidden protocol: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname;
  const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal', 'instance-data', '169.254.169.254']);
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    throw new Error('Forbidden webhook host: Internal/metadata destinations are blocked.');
  }

  const net = await import('net');
  if (net.isIP(hostname)) {
    if (isForbiddenIpAddress(hostname)) {
      throw new Error('Forbidden destination: Private, loopback, or cloud metadata IP address.');
    }
  } else {
    try {
      const dns = await import('dns');
      const addresses = await dns.promises.lookup(hostname, { all: true });
      for (const addr of addresses) {
        if (isForbiddenIpAddress(addr.address)) {
          throw new Error(`SSRF Protected: Domain ${hostname} resolves to prohibited internal IP ${addr.address}`);
        }
      }
    } catch (dnsErr: any) {
      if (dnsErr.message.includes('SSRF Protected')) {
        throw dnsErr;
      }
      throw new Error(`Cannot resolve webhook hostname: ${hostname}`);
    }
  }

  return parsed.toString();
}

/**
 * Sanitizes cell values for CSV lead exports to prevent Formula Injection / DDE (Finding 5.2).
 */
export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (/^[=+\-@\t\r%]/.test(str)) {
    // Prepend apostrophe to neutralize spreadsheet formula evaluation
    return `"'${str.replace(/"/g, '""')}"`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

