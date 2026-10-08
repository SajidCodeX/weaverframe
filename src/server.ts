import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// Attach Hardened Security Headers to all responses (PR-8)
function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Content Security Policy (Report-Only for maximum compatibility with client hydration & Stripe)
  if (!headers.has('Content-Security-Policy') && !headers.has('Content-Security-Policy-Report-Only')) {
    headers.set(
      'Content-Security-Policy-Report-Only',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://prod.spline.design; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob: cid:; connect-src 'self' https: wss:; frame-src 'self' https://js.stripe.com; object-src 'none'; base-uri 'self';"
    );
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isCsrfExempt(pathname: string): boolean {
  if (pathname === '/api/billing/webhook') return true;
  if (pathname === '/api/leads/inbound') return true;
  if (pathname.startsWith('/api/cron/')) return true;
  if (pathname === '/api/auth-sink') return true;
  return false;
}

function isAllowedOrigin(originHeader: string, requestHost: string): boolean {
  try {
    const originUrl = new URL(originHeader);
    const appBaseUrl = process.env.APP_BASE_URL;

    if (appBaseUrl) {
      try {
        const configuredUrl = new URL(appBaseUrl);
        if (originUrl.origin === configuredUrl.origin) return true;
      } catch {}
    }

    // Direct host match (e.g. host header with or without port)
    if (originUrl.host === requestHost) return true;
    if (originUrl.hostname === requestHost.split(':')[0]) return true;

    // Vercel deployment preview and production domains
    if (originUrl.hostname.endsWith('.vercel.app')) return true;

    // Weaverframe domains
    if (originUrl.hostname === 'weaverframe.in' || originUrl.hostname.endsWith('.weaverframe.in')) return true;

    // Local development match
    if (
      process.env.NODE_ENV !== 'production' &&
      (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1')
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response, isRpcOrApi: boolean): Promise<Response> {
  if (response.status < 500) return response;
  if (isRpcOrApi) {
    // API and RPC endpoints must NEVER be overwritten with an HTML error page!
    return response;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    const isRpcOrApi = url.pathname.startsWith('/_serverFn') || url.pathname.startsWith('/api');
    try {
      // CSRF / Origin Verification on mutating requests
      const method = request.method.toUpperCase();
      const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

      if (isMutating && !isCsrfExempt(url.pathname)) {
        const origin = request.headers.get('origin');
        const referer = request.headers.get('referer');
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host;

        if (origin) {
          if (!isAllowedOrigin(origin, host)) {
            console.warn(`[CSRF] Blocked mutating ${method} request from unauthorized origin: ${origin}`);
            return applySecurityHeaders(
              new Response(JSON.stringify({ error: 'CSRF Origin Verification Failed' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
              })
            );
          }
        } else if (referer) {
          try {
            const refererUrl = new URL(referer);
            if (!isAllowedOrigin(refererUrl.origin, host)) {
              console.warn(`[CSRF] Blocked mutating ${method} request from unauthorized referer: ${referer}`);
              return applySecurityHeaders(
                new Response(JSON.stringify({ error: 'CSRF Origin Verification Failed' }), {
                  status: 403,
                  headers: { 'Content-Type': 'application/json' },
                })
              );
            }
          } catch {
            return applySecurityHeaders(
              new Response(JSON.stringify({ error: 'CSRF Origin Verification Failed' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
              })
            );
          }
        }
      }

      if (url.pathname === '/api/auth-sink') {
        return applySecurityHeaders(
          new Response(
            `<!DOCTYPE html><html><head></head><body></body></html>`,
            {
              status: 200,
              headers: {
                'Content-Type': 'text/html',
              },
            }
          )
        );
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response, isRpcOrApi);
      return applySecurityHeaders(normalized);
    } catch (error) {
      console.error(error);
      if (isRpcOrApi) {
        return applySecurityHeaders(
          new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return applySecurityHeaders(brandedErrorResponse());
    }
  },
};
