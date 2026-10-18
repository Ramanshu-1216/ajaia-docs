import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // PGlite boots a WASM Postgres per test file; give it room on cold start.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
