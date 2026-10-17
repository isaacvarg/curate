import pg from "pg";

export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://app:app@localhost:5432/app_test";

// Empties every application table, keeping Prisma's migration history.
export async function resetDatabase(connectionString: string) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query<{ tablename: string }>(
      `select tablename from pg_tables
       where schemaname = 'public' and tablename <> '_prisma_migrations'`,
    );
    if (rows.length === 0) return;
    const tables = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
    await client.query(`truncate table ${tables} restart identity cascade`);
  } finally {
    await client.end();
  }
}
