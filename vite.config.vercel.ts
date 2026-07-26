// vite.config.vercel.ts
// This config is used ONLY for Vercel deployment (vercel.json buildCommand).
// The main vite.config.ts (with @lovable.dev/vite-tanstack-config) is used for local dev.
// This avoids the Cloudflare Workers plugin that @lovable.dev/vite-tanstack-config injects,
// which prevents Vercel from auto-detecting TanStack Start correctly.

import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      serverFns: { disableCsrfMiddlewareWarning: true },
    }),
    viteReact(),
  ],
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  build: {
    rollupOptions: {
      external: ["ws"],
    },
  },
});
