import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*"],
    // The mobile app and shared package have no tests until later tickets add them.
    passWithNoTests: true,
  },
});
