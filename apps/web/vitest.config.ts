import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";
import { testDatabaseUrl } from "./test/database";

export default defineProject({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    name: "web",
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    env: {
      DATABASE_URL: testDatabaseUrl,
      BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
      BETTER_AUTH_URL: "http://localhost:3000",
    },
    // Test files share one database and reset it, so they run one at a time.
    fileParallelism: false,
  },
});
