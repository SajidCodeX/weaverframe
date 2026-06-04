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

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Builder's Edge Dashboard" },
      { name: "description", content: "Track, manage, and convert AI-generated home buyer leads with Builder's Edge." },
      { name: "author", content: "Builder's Edge" },
      { name: "theme-color", content: "#0A0A0A" },
      { property: "og:title", content: "Builder's Edge Dashboard" },
      { property: "og:description", content: "Track, manage, and convert AI-generated home buyer leads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "icon", href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⬛</text></svg>" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/login' || location.pathname.startsWith('/api') || location.pathname.startsWith('/invite')) {
      return { session: null };  // Always return consistent shape — bare `return` (undefined) crashes RootComponent
    }

    // SSR: We no longer bypass session resolution. If the user has a single cookie, 
    // it will be correctly resolved on the server, avoiding the empty UI flash.
    let activeRole = undefined;
    if (typeof window !== 'undefined') {
      activeRole =
        // FIX-4: sessionStorage is wiped on tab close. Fall back to localStorage
        // so returning users (e.g. after 1 week) still send the correct role hint
        // to the server and avoid the multi-cookie UNAUTHORIZED redirect.
        sessionStorage.getItem('active_role') ??
        localStorage.getItem('active_role') ??
        undefined;
    }

    const session = await getSessionFn({ data: { activeRole } });
    if (!session) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      });
    }

    // Synchronously lock and self-heal tab identity on successful client-side validation
    if (typeof window !== 'undefined' && session?.role) {
      if (!sessionStorage.getItem('active_role')) {
        sessionStorage.setItem('active_role', session.role);
      }
      // FIX-4: also keep localStorage in sync so next cold visit has the role
      if (!localStorage.getItem('active_role')) {
        localStorage.setItem('active_role', session.role);
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
      <body className="font-sans antialiased bg-background text-foreground custom-scrollbar overflow-hidden">
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
