import { defineProject } from "vitest/config";

export default defineProject({
  // See tsconfig.vitest.json for why tests don't use tsconfig.json.
  tsconfig: "tsconfig.vitest.json",
  test: {
    name: "mobile",
    include: ["src/**/*.test.ts"],
  },
});
