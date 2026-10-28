import { defineConfig } from "vitest/config";
import path from "path";

// Mirrors tsconfig's "@/*" path alias so test files and the app code they
// import from can use the same import paths.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
