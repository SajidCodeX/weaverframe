// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  // Disable the Cloudflare Workers plugin — this app deploys to Vercel (Node.js serverless),
  // not Cloudflare Workers. Without this, Nitro builds to dist/server/ (Cloudflare format)
  // instead of .vercel/output/ (Vercel format), causing 404s on all routes.
  cloudflare: false,
  tanstackStart: {
    server: { 
      // NOTE: entry:"server" was Cloudflare Workers-specific — removed for Vercel deployment.
      // NITRO_PRESET env var in vercel.json handles the preset selection.
      preset: "vercel",
    },
    serverFns: { disableCsrfMiddlewareWarning: true }
  },
  vite: {
    build: {
      rollupOptions: {
        external: ["ws"],
      },
    },
  },
});
