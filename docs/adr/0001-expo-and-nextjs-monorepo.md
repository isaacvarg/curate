# Expo mobile app and Next.js API in one pnpm monorepo

The app is used mainly on phones (scanning QR Labels, photos, voice memos, logging at the table), but our deepest experience is with Next.js, Prisma, Postgres and rustfs. So we're building a pnpm-workspace monorepo with three parts:

- `apps/mobile` (Expo, iOS and Android)
- `apps/web` (Next.js, serving the typed RPC API, the web UI and public share/Label pages; it is the only code that touches Prisma)
- `packages/shared` (types, schemas and domain rules such as headline normalization, which must behave the same on the phone, including offline, and on the server)

Postgres and rustfs keep running from Docker Compose at the repo root.

## Considered Options

- **PWA only.** We rejected this because offline queued logging, push notifications and home-screen presence are weak on iOS.
- **Native Kotlin (plus Swift for iOS).** We rejected this because it means two client codebases and no type sharing with the TypeScript API.
- **PWA first, port to Expo later.** We rejected this because in practice it means building the UI twice.
- **Separate repos for mobile and web.** We rejected this because API types and domain rules would have to be copied by hand.
