# Open Questions and Deferred Topics

Things the design session deliberately did **not** settle, so nobody mistakes them for decisions. Settled decisions are in [decision-log.md](decision-log.md).

## Deferred to their own sessions

- **Product name.** "Curate & Critique" is being retired because it's bad for marketing. "Curate" is a placeholder in GLOSSARY.md and the repo name. Label URLs must not depend on the final name (NFR-7).
- **Pricing and monetization.** The only commitment so far is tracking media size per user. Open: free versus paid tiers, storage limits (especially video), and which features to gate.

## Not yet designed

- **Rating Card configuration details.** Layout options, branding, what a public Rating Card link page shows.
- **Feed design.** Which actions create feed posts (Sessions, Overall Ratings, new Items, Occasions) and how they're grouped.
- **Moderation and reporting** for public content, Communities and Clubs.
- **Template update offers.** What an "update available" comparison looks like when the adopter has customized the Template.
- **Community Templates.** Contributor rankings, discovery, quality signals.
- **Guest claiming flow.** How a new User proves they are "Sam" on someone else's Sessions.
- **Catalog Entry matching.** Linking existing Items to Catalog Entries when the Catalog launches (suggestions, bulk matching).
- **Auth and accounts.** Sign-in methods, account deletion and its effect on shared Collections, Sessions and Linked Items.
- **Notifications.** What is pushed (Meetup reminders, Challenge progress, follow prompts) and the defaults.
- **Full offline-first support** beyond queued logging.
- **Media handling.** Size limits, video length, transcoding, voice memo transcription.

## Ideas mentioned but not committed

- A Label designer, possibly reusing the node editor's infrastructure.
- Node editor on mobile.
- Custom metric dashboards.
- Importers for specific apps (BG Stats, Untappd, Goodreads) and outside catalogs (BGG, Open Library, TMDB).
