import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["**/dist/**", "**/node_modules/**"],
    coverage: {
      provider: "v8",
      include: [
        "packages/shared/src/**/*.ts",
        "apps/worker/src/scrapers/**/*.ts",
        "apps/web/src/lib/**/*.ts",
      ],
      exclude: ["**/*.test.ts", "**/index.ts"],
    },
  },
  resolve: {
    alias: {
      "@lecture-seeker/shared": path.resolve(__dirname, "packages/shared/src"),
      "@": path.resolve(__dirname, "apps/web/src"),
    },
  },
});
