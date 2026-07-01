import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // Match Next's "@/..." import alias to the project root.
      "@": resolve(__dirname, "."),
      // "server-only" throws outside a Next server bundle; stub it in tests.
      "server-only": resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
