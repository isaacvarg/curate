import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*"],
    // The mobile app has no tests until a later ticket adds them.
    passWithNoTests: true,
  },
});
