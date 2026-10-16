# oRPC for the API, Better Auth for accounts

The Expo app and the web app call the server through **oRPC** procedures defined in `apps/web`, with zod inputs and a typed client. Accounts and sessions use **Better Auth**, stored in our own Postgres via its Prisma adapter. The mobile app keeps its session in secure storage through Better Auth's Expo integration, and the web app uses cookies. We chose oRPC over tRPC because it gives the same typed-client experience and can also publish an OpenAPI/REST spec from the same procedures. That keeps the option open for public Label pages, Rating Card links and outside integrations without a second API layer. We chose Better Auth because it's self-hosted on our existing Postgres (no third-party user store) and supports Expo out of the box.

## Considered Options

- **tRPC.** The most established option, but only TypeScript clients can use it, so any future public or integration API would need a separate REST layer.
- **Next.js route handlers + shared zod schemas.** No dependency, but routes, methods and the mobile client would be kept in sync by hand.
- **Server Actions.** Ruled out: the mobile app can't call them.
- **Auth.js (NextAuth).** Common with Next.js, but weaker support for native mobile sessions.
- **Hosted auth (Clerk, Auth0 and similar).** Rejected to keep user data in our own database and avoid per-user pricing before monetization is decided.
