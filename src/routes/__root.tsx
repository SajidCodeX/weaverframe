import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  redirect,
} from "@tanstack/react-router";
import { Settings, LogOut, Search, User as UserIcon } from "lucide-react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getSessionFn } from "@/lib/auth";

import appCss from "../styles.css?url";

import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/500.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/400-italic.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground tracking-tight">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Client-side session cache ─────────────────────────────────────────────────
// Eliminates the HTTP round-trip to getSessionFn on tab switches.
// JWT cookie is still the source of truth — this just avoids redundant calls.
let _clientSession: any = null;

export function invalidateClientSession(updatedSession?: any) {
  if (typeof window !== 'undefined') {
    if (updatedSession) {
      _clientSession = { ...(_clientSession || {}), ...updatedSession };
    } else {
      _clientSession = null;
    }
  }
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "WeaverFrame Dashboard" },
      { name: "description", content: "Track, manage, and convert AI-generated home buyer leads with WeaverFrame." },
      { name: "author", content: "WeaverFrame" },
      { name: "theme-color", content: "#0A0A0A" },
      { property: "og:title", content: "WeaverFrame Dashboard" },
      { property: "og:description", content: "Track, manage, and convert AI-generated home buyer leads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/welcome' || location.pathname === '/login' || location.pathname.startsWith('/api') || location.pathname.startsWith('/invite') || location.pathname.startsWith('/portal')) {
      return { session: null };  
    }

    let activeRole: string | undefined = undefined;
    if (typeof window !== 'undefined') {
      activeRole = sessionStorage.getItem('active_role') ?? undefined;
    }

    // ── Fast-path after login ────────────────────────────────────────────────
    if (typeof window !== 'undefined') {
      const pending = (window as any).__pendingLoginSession;
      if (pending) {
        delete (window as any).__pendingLoginSession;
        _clientSession = pending;
        if (pending.role === 'admin' && !pending.actingAsBuilderId && !location.pathname.startsWith('/admin')) {
          throw redirect({ to: '/admin' });
        }
        return { session: pending };
      }
    }

    // ── Client-side cache hit — skip HTTP entirely ───────────────────────────
    // We cache this indefinitely in browser memory for the lifetime of the tab.
    // Why? Because every server function (getLeadsData, etc.) ALREADY validates 
    // the session on the server. If auth is revoked, the data fetch will fail 
    // anyway. We don't need to block UI navigation just to double-check auth.
    if (typeof window !== 'undefined' && _clientSession) {
      const s = _clientSession;
      if (s.role === 'admin' && !s.actingAsBuilderId && !location.pathname.startsWith('/admin')) {
        throw redirect({ to: '/admin' });
      }
      return { session: s };
    }

    // ── Cache miss (Initial Load) — call server ──────────────────────────────
    const session = await getSessionFn({ data: { activeRole } });
    if (!session) {
      _clientSession = null;
      
      // If unauthenticated user hits the root domain, show them the marketing landing page
      if (location.pathname === '/') {
        throw redirect({ to: '/welcome' });
      }
      
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      });
    }

    // Cache on client indefinitely for this tab
    if (typeof window !== 'undefined') {
      _clientSession = session;
    }

    // Synchronously lock and self-heal tab identity on successful client-side validation
    if (typeof window !== 'undefined' && session?.role) {
      if (!sessionStorage.getItem('active_role')) {
        sessionStorage.setItem('active_role', session.role);
      }
      const tabId = sessionStorage.getItem('tab_id');
      if (tabId && !localStorage.getItem(`role_${tabId}`)) {
        localStorage.setItem(`role_${tabId}`, session.role);
      }
    }
    
    // Admin users are restricted to /admin unless they are actively previewing a builder workspace
    if (session.role === 'admin' && !session.actingAsBuilderId && !location.pathname.startsWith('/admin')) {
      throw redirect({ to: '/admin' });
    }

    // Return session so it is available via useRouteContext({ strict: false }) in Sidebar and all child routes
    return { session };
  },
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased bg-background text-foreground custom-scrollbar">
        <ThemeProvider defaultTheme="dark" storageKey="builders-edge-theme">
          {children}
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}

import { Toaster } from "sonner";

function RootComponent() {
  const { queryClient } = Route.useRouteContext() as any;

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="dark" position="bottom-right" />
    </QueryClientProvider>
  );
}
