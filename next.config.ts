import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is intentionally off: every page here is per-user and
  // cookie-driven, and its Activity-based navigation keeps visited routes alive
  // with their state, so returning to a document could show a stale in-memory
  // editor instead of fresh server content. See ARCHITECTURE.md.

  // PGlite ships a WASM Postgres + data files; load it from node_modules at
  // runtime instead of bundling it.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
