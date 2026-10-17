import { execFileSync } from "node:child_process";
import pg from "pg";
import { testDatabaseUrl } from "./database";

// Creates the dedicated test database if needed and migrates it once per run.
export default async function setup() {
  const url = new URL(testDatabaseUrl);
  const name = url.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = "/postgres";

  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [name]);
    if (!rowCount) await client.query(`create database "${name}"`);
  } finally {
    await client.end();
  }

  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
  });
}
