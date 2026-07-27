/**
 * vercel-postbuild.mjs
 *
 * Converts vite build output (dist/server/ + dist/client/) into
 * Vercel Build Output API v3 format (.vercel/output/).
 *
 * Steps:
 *  1. Skip if Nitro already created .vercel/output/
 *  2. Copy dist/client/ → .vercel/output/static/
 *  3. Use esbuild to bundle dist/server/server.js (+ all node_modules deps)
 *     into a single .vercel/output/functions/server.func/index.js
 *  4. Write .vc-config.json and config.json
 *
 * This project uses @prisma/adapter-pg (pure JS driver adapter) so there
 * are NO native binary deps — esbuild can bundle everything.
 */

import { cpSync, existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { build as esbuild } from "esbuild";

const ROOT = process.cwd();
const VERCEL_OUT = join(ROOT, ".vercel", "output");
const DIST_CLIENT = join(ROOT, "dist", "client");
const DIST_SERVER = join(ROOT, "dist", "server");

// --- Guard: if Nitro already created .vercel/output, nothing to do ---
if (existsSync(join(VERCEL_OUT, "config.json"))) {
  console.log(
    "✅ .vercel/output already exists (Nitro vercel preset). Skipping manual conversion."
  );
  process.exit(0);
}

console.log(
  "⚙️  Nitro preset not detected — converting build output to Vercel Build Output API format..."
);

if (!existsSync(DIST_CLIENT)) {
  console.error("❌ dist/client not found. Run vite build first.");
  process.exit(1);
}
if (!existsSync(DIST_SERVER)) {
  console.error("❌ dist/server not found. Run vite build first.");
  process.exit(1);
}

// 1. Create directory structure
const STATIC_DIR = join(VERCEL_OUT, "static");
const FUNC_DIR = join(VERCEL_OUT, "functions", "server.func");
mkdirSync(STATIC_DIR, { recursive: true });
mkdirSync(FUNC_DIR, { recursive: true });

// 2. Copy static client assets → .vercel/output/static/
console.log("📁 Copying client assets → .vercel/output/static/ ...");
cpSync(DIST_CLIENT, STATIC_DIR, { recursive: true });

// 3. Copy Prisma into function node_modules so it's available at runtime
console.log("📁 Copying Prisma to server function node_modules ...");
const FUNC_NODE_MODULES = join(FUNC_DIR, "node_modules");
mkdirSync(FUNC_NODE_MODULES, { recursive: true });
if (existsSync(join(ROOT, "node_modules", "@prisma"))) {
  cpSync(join(ROOT, "node_modules", "@prisma"), join(FUNC_NODE_MODULES, "@prisma"), { recursive: true });
}
if (existsSync(join(ROOT, "node_modules", ".prisma"))) {
  cpSync(join(ROOT, "node_modules", ".prisma"), join(FUNC_NODE_MODULES, ".prisma"), { recursive: true });
}

// 4. Bundle server code with ALL dependencies (except Prisma/ws) using esbuild
//    dist/server/server.js → ./assets/server-xxx.js → node_modules (externalized by Vite)
//    esbuild re-bundles everything into one self-contained file.
console.log("📦 Bundling server + dependencies with esbuild ...");

await esbuild({
  entryPoints: [join(DIST_SERVER, "server.js")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: join(FUNC_DIR, "server-bundle.js"),
  // This project uses @prisma/adapter-pg (pure JS) — no native bindings.
  external: ["ws", "@prisma/client", ".prisma/client"],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  // Allow circular imports (Prisma, TanStack internals use them)
  ignoreAnnotations: true,
  // Suppress noisy esbuild warnings
  logLevel: "warning",
});

console.log("✅ Server bundle created → .vercel/output/functions/server.func/index.js");

// 5. Write .vc-config.json (Vercel function runtime config)
writeFileSync(
  join(FUNC_DIR, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.js",
      supportsResponseStreaming: true,
    },
    null,
    2
  )
);

// 6. Write full adapter index.js wrapper
//    Vercel Node.js runtime passes (req, res) (IncomingMessage, ServerResponse)
//    But app.fetch expects a Web Request. We manually convert.
writeFileSync(
  join(FUNC_DIR, "index.js"),
  `// Auto-generated Node.js to Web Request adapter
import app from "./server-bundle.js";

export default async function handler(req, res) {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const url = new URL(req.url || '/', \`\${protocol}://\${host}\`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => headers.append(key, v));
        } else {
          headers.set(key, value);
        }
      }
    }

    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = new ReadableStream({
        start(controller) {
          req.on('data', chunk => controller.enqueue(chunk));
          req.on('end', () => controller.close());
          req.on('error', err => controller.error(err));
        }
      });
    }

    const webReq = new Request(url, {
      method: req.method,
      headers,
      body,
      duplex: 'half'
    });

    const webRes = await app.fetch(webReq, {}, {});

    res.statusCode = webRes.status;
    res.statusMessage = webRes.statusText;
    webRes.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (webRes.body) {
      const reader = webRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Wrapper error:', error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
`
);

// 7. Write .vercel/output/config.json (Vercel routing rules)
writeFileSync(
  join(VERCEL_OUT, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        // Cache content-hashed static assets indefinitely
        {
          src: "^/_build/assets/(.*)$",
          headers: { "cache-control": "public, max-age=31536000, immutable" },
          continue: true,
        },
        // Serve static files from CDN if they exist
        { handle: "filesystem" },
        // All other requests → SSR serverless function
        { src: "/(.*)", dest: "/server" },
      ],
    },
    null,
    2
  )
);

console.log("\n✅ .vercel/output/ created successfully!");
console.log("   → static/                          (client assets)");
console.log("   → functions/server.func/index.js   (bundled SSR + deps)");
console.log("   → config.json                      (routing rules)");
