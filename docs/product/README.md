# Product Docs

Output of the product design session (2026-10-14 → 2026-10-16). Start here.

| Document | What it's for |
|---|---|
| [GLOSSARY.md](../../GLOSSARY.md) | The canonical vocabulary. Use these terms everywhere. |
| [decision-log.md](decision-log.md) | Every question asked and answered, round by round, with reasoning |
| [features.md](features.md) | Feature catalog grouped by area, tagged v1 / Social / Later |
| [requirements.md](requirements.md) | Functional (FR-x) and non-functional (NFR-x) requirements with stable IDs |
| [scenarios.md](scenarios.md) | Worked examples that stress-test the model (game night, brewery day, TV spreadsheet…) |
| [open-questions.md](open-questions.md) | What was deliberately left undecided |

## Architecture Decision Records

| ADR | Decision |
|---|---|
| [0001](../adr/0001-expo-and-nextjs-monorepo.md) | Expo mobile app and Next.js API in one pnpm monorepo |
| [0002](../adr/0002-one-expression-model.md) | One expression model for scores, Verdicts, conditions and Challenges |
| [0003](../adr/0003-one-home-collection-per-item.md) | Every Item has one home Collection; cross-Collection presence uses Linked Items |
| [0004](../adr/0004-verdict-and-comparison-tiers.md) | Comparison through a required Verdict, Shared Fields, and percentile |
| [0005](../adr/0005-orpc-and-better-auth.md) | oRPC for the API, Better Auth for accounts |
| [0006](../adr/0006-score-cards-chosen-per-item.md) | Score Cards are chosen per Item, not configured per Level |
| [0007](../adr/0007-occasion-links-belong-to-the-user.md) | A Session's place in an Occasion belongs to the Occasion's User |
| [0008](../adr/0008-media-uploaded-separately-and-processed-on-device.md) | Media is uploaded separately, straight to rustfs, and processed only on the phone |
| [0009](../adr/0009-labels-encode-an-opaque-code-on-a-neutral-domain.md) | Labels encode an opaque code on a neutral, permanent Label domain |
| [0010](../adr/0010-challenges-are-a-match-expression-plus-a-fixed-measure.md) | Challenges are a match expression plus a fixed measure |
| [0011](../adr/0011-templates-are-published-snapshots-adopted-as-copies-with-origin-keys.md) | Templates are published snapshots, adopted as copies with origin keys |
| [0012](../adr/0012-shared-saves-are-patched-from-a-base-revision.md) | Shared saves are patched from a base revision |
