import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Separate vitest config for integration tests that hit real Groq + Neon.
 * Run with: npx vitest --config vitest.integration.config.ts run
 *
 * Requires:
 *   - GROQ_API_KEY_TEST (a real Groq key — bills tokens against your account)
 *   - DATABASE_URL_TEST (a Neon branch / test database)
 *
 * Tests auto-skip when either env is missing.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/integration/**/*.integration.test.{ts,tsx}"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
