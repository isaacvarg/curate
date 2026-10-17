import { beforeAll } from "vitest";
import { resetDatabase, testDatabaseUrl } from "./database";

// Each test file starts from an empty database.
beforeAll(async () => {
  await resetDatabase(testDatabaseUrl);
});
