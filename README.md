# Curate

A personal app for collecting, rating and journaling anything. "Curate" is a placeholder name, set once in `packages/shared/src/product.ts`.

Product docs start at [docs/product/README.md](docs/product/README.md). Vocabulary is in [GLOSSARY.md](GLOSSARY.md), decisions in [docs/adr/](docs/adr/).

## Layout

- `apps/web`: Next.js. Hosts the oRPC API (`/rpc`), Better Auth (`/api/auth`) and Prisma. The only package that touches the database.
- `apps/mobile`: Expo (Expo Router). Reaches the server only through the typed oRPC client.
- `packages/shared`: the API contract, zod schemas and domain rules shared by both.

## Getting started

Requires Node 26, pnpm (pinned in `mise.toml`) and Docker.

```bash
pnpm install
pnpm infra:up                         # Postgres and rustfs from docker-compose.yml
cp apps/web/.env.example apps/web/.env
pnpm db:migrate
pnpm dev:web                          # API on http://localhost:3000
pnpm dev:mobile                       # Expo; press i or a for a simulator
```

The mobile app calls port 3000 on the machine running Metro. Set `EXPO_PUBLIC_API_URL` to point it elsewhere.

## Checks

```bash
pnpm typecheck
pnpm test
```

API tests call procedures in-process (`apps/web/test/harness.ts`) against a dedicated `app_test` database on the Compose Postgres. It is created and migrated before each run and emptied before each test file. Override it with `TEST_DATABASE_URL`.

New migration: edit `apps/web/prisma/schema.prisma`, then `pnpm --filter @repo/web db:migrate:new --name <name>`.
