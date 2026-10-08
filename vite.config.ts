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
      preset: "node-server",
    },
    serverFns: { disableCsrfMiddlewareWarning: true }
  },
  vite: {
    optimizeDeps: {
      include: [
        "lenis",
        "framer-motion",
        "recharts",
        "embla-carousel-react",
        "lucide-react",
      ],
    },
    build: {
      rollupOptions: {
        external: ["ws"],
      },
    },
    plugins: [
      {
        name: 'node-browser-shims',
        enforce: 'pre',
        resolveId(id, _importer, options) {
          if (options?.ssr || this.environment?.name === 'server') {
            return null;
          }
          if (id === 'node:stream' || id === 'stream') {
            return '\0virtual:node-stream-shim';
          }
          if (id === 'node:async_hooks' || id === 'async_hooks') {
            return '\0virtual:node-async-hooks-shim';
          }
          return null;
        },
        load(id) {
          if (id === '\0virtual:node-stream-shim') {
            return `
              export class Readable {}
              export class Writable {}
              export class Transform {}
              export class PassThrough {}
              export class Stream {}
              export const pipeline = () => {};
              export const finished = () => {};
              export default {
                Readable,
                Writable,
                Transform,
                PassThrough,
                Stream,
                pipeline,
                finished,
              };
            `;
          }
          if (id === '\0virtual:node-async-hooks-shim') {
            return `
              export class AsyncLocalStorage {
                getStore() { return undefined; }
                run(store, callback, ...args) { return typeof callback === 'function' ? callback(...args) : undefined; }
                enterWith(store) {}
                disable() {}
                exit(callback, ...args) { return typeof callback === 'function' ? callback(...args) : undefined; }
              }
              export class AsyncResource {
                runInAsyncScope(fn, thisArg, ...args) { return fn.apply(thisArg, args); }
              }
              export default { AsyncLocalStorage, AsyncResource };
            `;
          }
          return null;
        },
      },
    ],
    preview: {
      allowedHosts: true,
    },
  },
});
