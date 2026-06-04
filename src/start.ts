import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

if (typeof window !== "undefined") {
  // ─── Tab Identity ──────────────────────────────────────────────────────────
  // window.name persists across reloads in the same tab. Use it as a stable
  // tab ID so each browser tab has its own isolated role context.
  if (!window.name || !window.name.startsWith('tab_')) {
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2) + Date.now().toString(36);
    window.name = `tab_${uuid}`;
  }
  const tabId = window.name;
  sessionStorage.setItem('tab_id', tabId);

  // ─── Role Resolution (BUG-01 FIX) ─────────────────────────────────────────
  // OLD (broken): Guessed role from URL pathname → overwrote correct sessionStorage
  // before React mounted → sign-in appeared to do nothing.
  //
  // NEW (correct): Priority chain — never guess blindly from URL.
  //   1. Already in sessionStorage (e.g., user is mid-session, already hydrated)
  //   2. localStorage.active_role  (set on successful login, survives tab close)
  //   3. localStorage.role_${tabId} (per-tab fallback for backward compat)
  //   4. NOTHING on /login or /invite — let login.tsx set it after auth succeeds
  //   5. URL-based guess ONLY for non-auth pages when truly no role is stored
  const alreadyInSession = sessionStorage.getItem('active_role');

  if (!alreadyInSession) {
    const persistedRole =
      localStorage.getItem('active_role') ||      // primary: set on login
      localStorage.getItem(`role_${tabId}`);       // fallback: per-tab

    if (persistedRole) {
      // Restore known role into this tab's session
      sessionStorage.setItem('active_role', persistedRole);
      localStorage.setItem(`role_${tabId}`, persistedRole); // keep in sync
    } else {
      // No stored role at all. Only guess from URL on protected routes.
      // On /login and /invite: do NOT set anything — login.tsx will set it
      // after the user authenticates. Guessing here was the root cause of BUG-01.
      const isPublicRoute =
        window.location.pathname.startsWith('/login') ||
        window.location.pathname.startsWith('/invite');

      if (!isPublicRoute) {
        // Last-resort guess for direct navigation to a protected route with
        // no stored role (e.g., typing /admin in address bar on a fresh browser).
        // This is benign — beforeLoad will redirect to /login if the cookie is missing.
        const guessedRole = window.location.pathname.startsWith('/admin')
          ? 'admin'
          : 'builder';
        sessionStorage.setItem('active_role', guessedRole);
        localStorage.setItem(`role_${tabId}`, guessedRole);
      }
      // On /login with no stored role: sessionStorage.active_role stays UNSET.
      // The fetch interceptor below will send no x-active-role header for the
      // loginFn call — which is correct, loginFn doesn't need it.
    }
  }

  // ─── Fetch Interceptor (BUG-02 FIX) ───────────────────────────────────────
  // Injects x-active-role on every same-origin request so the server knows
  // which role cookie to read when multiple cookies are present.
  // Reads from sessionStorage at call-time (not captured at startup) so it
  // always picks up the latest role, including after login.tsx sets it.
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;

    const isSameOrigin = url.startsWith('/') || url.startsWith(window.location.origin);

    if (isSameOrigin) {
      // Read at call-time, not from startup closure — always fresh
      const currentRole = sessionStorage.getItem('active_role');
      init = init || {};
      const headers = new Headers(init.headers || {});

      if (currentRole && !headers.has('x-active-role')) {
        headers.set('x-active-role', currentRole);
      }

      if (!headers.has('x-client-path')) {
        headers.set('x-client-path', window.location.pathname);
      }

      init = { ...init, headers };
    }

    return originalFetch(input, init);
  };
}

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
}));

