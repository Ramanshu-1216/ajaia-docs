import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is intentionally off: every page here is per-user and
  // cookie-driven, and Activity-preserved hidden routes would keep editor
  // autosave timers alive after navigating away. See ARCHITECTURE.md.

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
