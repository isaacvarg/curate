# Feature Catalog

Every feature agreed in the design session, grouped by area and tagged by phase. Terms in **bold** are defined in [GLOSSARY.md](../../GLOSSARY.md). The reasoning for each decision is in [decision-log.md](decision-log.md).

**Phases:** `v1` = the solo loop plus households, which ships first. `Social` = the social phase. `Later` = after that, or unscheduled.

---

## 1. Collections and Items

| Feature | Phase | Notes |
|---|---|---|
| Create a **Collection** of anything | v1 | Blank, or from an **Official Template** |
| Declare **Levels** (e.g. Show › Season › Episode) | v1 | Any depth, but declared explicitly. A single Level for flat Collections such as beer |
| Create **Items** at any Level, with a parent at the Level above | v1 | An Item has exactly one home Collection |
| Bulk-generate child Items ("Season 2: 10 Episodes") | v1 | |
| Configure **Attributes** per Level (ABV, brewery, player count, genre…) | v1 | Attributes can be conditional on other Attributes |
| Configure **Status** options per Collection (owned, played elsewhere, digital, sold, wishlist…) | v1 | Or no Status at all |
| **Tags** on Items, Sessions and Occasions | v1 | Free-form, cross-Collection, never drive fields |
| Per-Item "hide" from shared or public views | Social | Overrides the Collection's Visibility |
| **Linked Items** (Club pick ↔ personal copy, Session Participant's own copy) | Social | Each keeps its own fields, and Verdicts are visible across the link |
| Link Items to **Catalog Entries** | Later | No Catalog in v1 |
| Catalog Entries bundled with Templates | Later | e.g. every One Piece volume |
| Import Catalog Entries from outside catalogs (BGG, Open Library, TMDB) | Later | Users never create Catalog Entries directly |

## 2. Rating

| Feature | Phase | Notes |
|---|---|---|
| **Overall Rating** per Item, made up of a **Verdict** plus any other **Rating** fields | v1 | |
| Separate Overall and Session forms per Level ("same as Overall" allowed) | v1 | |
| **Verdict** on every rating: bounded and ordered (stars, /100, /10, tiers, thumbs) | v1 | Always present, pre-filled (default "Overall ★1–5"), renamable and rescalable |
| Verdict entered by hand or calculated from other fields | v1 | Calculated via the expression model |
| Conditional fields (e.g. Characters/Plot only when Genre = Fiction) | v1 | Conditions look at Attributes only |
| Configurable "number that represents the Item" per Collection | v1 | Overall → Session average (default), latest Session, Participant average, average of child Items |
| **Observation** fields (tasting notes, flavor descriptors, complexity) | v1 | Non-evaluative |
| **Shared Fields** from Official Templates (locked scale, comparable between users) | v1 | Comparison features between users come in Social |
| Percentile within a Collection (e.g. "top 5% of your whiskies") | v1 | Powers cross-Collection rankings |
| Community averages on Catalog Entries, shown in the viewer's scale | Later | Requires the Catalog |
| "Others rating whisky use these fields. Use them too?" suggestions | Later | Ranked by adoption |

## 3. Sessions and Score Cards

| Feature | Phase | Notes |
|---|---|---|
| Log a **Session** for one Item | v1 | Plus optional "used" child Items (expansions) |
| **Participants**: Users or **Guests** | v1 | Guests are named and owned by the logger |
| Per-Participant Ratings, Observations, Scores and notes | v1 | |
| **Score Cards** built in the node editor | v1 | Web only in v1. Phones fill them in and show a read-only graph |
| Node types: arithmetic, multipliers, min/max, powers, lookup tables | v1 | |
| Node type: [rank among Participants] (Longest Road, majorities, round goals) | v1 | Totals stay incomplete until every input they need is entered |
| Per-**Round** fields, fixed or open-ended number of Rounds | v1 | Golf, Cribbage, bowling |
| Win rules: highest, lowest, co-op win/lose, **Teams**, no winner | v1 | |
| Ordered tiebreaker fields | v1 | |
| Expansion-conditional Score Card fields | v1 | Via conditions |
| Validation: loops can't be saved; missing inputs show "incomplete" | v1 | Never a silently wrong winner |
| One phone enters every Participant's column | v1 | |
| User Participants enter their own column from their own phone | Social | |
| Session appears in User Participants' histories, with an offer to create a Linked Item | Social | |
| Guest claiming by a real User | Social | |
| Node editor on mobile | Later | |

## 4. Journal and Occasions

| Feature | Phase | Notes |
|---|---|---|
| **Occasions**: dated journal entries | v1 | Can stand alone, Day One style, or contain Sessions |
| Group Sessions into an Occasion when logging or afterwards | v1 | A Session belongs to at most one Occasion per User ([ADR 0007](../adr/0007-occasion-links-belong-to-the-user.md)) |
| An **open Occasion** that new Sessions join by default | v1 | Started and ended explicitly; one per User |
| Occasion Participants become defaults for its Sessions | v1 | |
| Notes and media (photos, video, voice memos) on an Occasion, a Session, or a Participant | v1 | Processed on the phone, uploaded separately ([ADR 0008](../adr/0008-media-uploaded-separately-and-processed-on-device.md)) |
| Journal timeline screen | v1 | A view, not an object |
| "On this day" resurfacing | v1 | |
| Optional one-tap location, private by default | v1 | Never captured silently |

## 5. Labels

| Feature | Phase | Notes |
|---|---|---|
| A QR **Label** per Item, encoding an https URL | v1 | Works with any phone camera; opens the app if it's installed. An opaque code on a neutral Label domain ([ADR 0009](../adr/0009-labels-encode-an-opaque-code-on-a-neutral-domain.md)) |
| Configurable scan action per Collection: start a Session or open the Item | v1 | A started Session pre-fills date, open Occasion and usual Participants |
| Printable PDFs: sticker-sheet grids plus ex libris designs | v1 | |
| Non-owner scan: public Item page, or a minimal "belongs to…" page | v1 | v1 ships the minimal page. The public Item page comes with Visibility (Social) |
| Scanned Label shows Status (e.g. Sold) after the Item leaves | v1 | The Label stays tied to the original Item |
| Non-owner User joins or logs the Session from their own account | Social | |
| Label designer | Later | Could reuse the node or design editor |
| Transferring a Label to a new owner | Social | |

## 6. Metrics and Challenges

| Feature | Phase | Notes |
|---|---|---|
| Activity heatmap (Sessions and Occasions) | v1 | GitHub style |
| Breakdowns by Tag, Attribute and Status | v1 | Pie and bar charts |
| Verdict distribution; top Items by percentile | v1 | Including across Collections |
| Most frequent Observations | v1 | e.g. most-detected whisky notes |
| Score Card stats: win rate, best scores, category averages | v1 | "Play group" stats come from Participants |
| Personal **Challenges** (criteria + time window) | v1 | A match expression plus a fixed measure ([ADR 0010](../adr/0010-challenges-are-a-match-expression-plus-a-fixed-measure.md)) |
| Club and Community Challenges | Social | |
| Custom dashboards | Later | |

## 7. Sharing and Templates

| Feature | Phase | Notes |
|---|---|---|
| **Rating Cards**: styled image or public link of a rating, choosing which fields and media to show | v1 | Shareable to any app |
| Official (curated) **Templates** | v1 | Levels, Attributes, fields, Score Cards, Statuses, scan action. Published from a curator's Collection ([ADR 0011](../adr/0011-templates-are-published-snapshots-adopted-as-copies-with-origin-keys.md)) |
| Adopting a Template copies it; later updates are offered, never forced | v1 | Offered change by change, keeping your own edits by default. Shared Fields keep their identity until detached |
| Community Templates with contributor rankings | Later | Can't create Shared Fields |

## 8. Social

| Feature | Phase | Notes |
|---|---|---|
| Shared household Collections (**Collection Members**) | v1 | Shared: Items, Attributes, Status, Labels, Sessions. Personal: Overall Ratings, Verdicts, Tags |
| Any Collection Member edits a Session's shared parts | v1 | Personal Ratings and Observations are editable only by their owner. Concurrent saves merge cell by cell ([ADR 0012](../adr/0012-shared-saves-are-patched-from-a-base-revision.md)) |
| A leaving member gets a copy of the Collection | v1 | The original and its Labels stay with the remaining members |
| **Visibility** per Collection: Private / Followers / Public | Social | Inherited by Items, Sessions and Overall Ratings |
| Account-wide Visibility for journal and Occasion content | Social | Private by default |
| Guest names never public ("+2 guests") | Social | Visible only to the owner and fellow Collection Members |
| One-way **Follow**, opting into Collections one at a time | Social | Nothing is followed by default. Approval optional |
| Nudge when a followed User starts a new Collection | Social | |
| Following someone's journal as a separate opt-in | Social | |
| Feed | Social | |
| **Clubs** (standalone or inside a Community) that can own Collections | Social | |
| **Communities** with a feed, Meetups, Clubs and stats | Social | |
| **Meetups**: attending creates your own linked Occasion | Social | |
| Community stats only from Sessions in Occasions linked to Meetups | Social | |
| Roles Owner / Admin / Member; joining open, approval-required or invite-only | Social | |

## 9. Data and platform

| Feature | Phase | Notes |
|---|---|---|
| iOS and Android app (Expo) | v1 | |
| Web app (Next.js): node editor, public pages, Rating Card and Label landing pages | v1 | |
| Logging that queues offline (Sessions and media), syncing later | v1 | |
| CSV import with column → field mapping, including across Levels | v1 | |
| Full export: CSV and JSON, media included | v1 | |
| Media size tracked per user | v1 | For future pricing |
| Importers for specific apps (BG Stats, Untappd, Goodreads) | Later | |
| Full offline-first browsing and editing | Later | |
