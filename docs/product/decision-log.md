# Decision Log: Product Design Session (2026-10-14 → 2026-10-16)

A complete record of every question asked and answered while grilling the product idea (working name "Curate", formerly "Curate & Critique"; the name will change). Terms in **bold** are defined in [GLOSSARY.md](../../GLOSSARY.md).

Each entry gives the decision, the recommendation it responded to, and the reasoning. Entries are grouped by round, in the order they were settled.

## Starting brief

The app lets users rate, collect and interact with (log/journal Sessions of) anything: board games, beer, tinned fish, books, manga, TV.

Original notebook features:

- Rate anything
- Collection entry labels (label or ex libris printout) with a QR code to log a session with that item
- Rating cards that are configurable and shareable
- Photos, videos, notes, voice memos
- Custom score cards (board game score sheets; whisky/beer profiles: peat, legs, wood)
- "Shareable configurable score cards" (a suspected duplicate; resolved as Templates)
- Follow another user's feed, toggling some of their collections off
- Metrics (GitHub-style heatmaps, pie charts of tags/content)
- Challenges
- Groups
- Community templates / baked-in collections with everything configured

---

## Round 1: Foundations

| # | Question | Decision | Reasoning |
|---|---|---|---|
| 1.1 | Are Items a shared catalog or personal? | **Hybrid.** Users create personal Items, which may optionally link to a shared **Catalog Entry**. Users manage and customize their own Item regardless of the link. | "Rate anything" rules out a curated-only catalog, but social and discovery features need to recognize two users' "Wingspan" as the same thing. |
| 1.2 | What does "collect" mean? | A **Collection** is a neutral grouping of Items. Ownership is separate (see **Status**). A board game Item may be physically owned, or played via a friend's copy, Board Game Arena, or a digital edition. A beer Item is a beer consumed and rated. | Avoids "collection" meaning both "things I own" and "things I've tried". |
| 1.3 | Can an Item be in several Collections? | **No. An Item has exactly one home Collection.** Cross-cutting groupings use **Tags** ("nature", "best with 2 players"). | Keeps "which rating form applies?" unambiguous. (Sub-collections were raised here and resolved in 2.1.) See [ADR 0003](../adr/0003-one-home-collection-per-item.md). |
| 1.4 | How do a rating and a Session relate? | **Both exist independently.** An Item can have a standing **Overall Rating**, plus per-Session ratings that can be averaged or aggregated. Each Collection/Item has its own configurable rating schema (e.g. fiction books get Characters/Plot/Setting; non-fiction doesn't). Every Session **Participant** can optionally give their own rating. | A board game's score sheet is a different thing from your opinion of the game, while a whisky tasting note *is* an opinion. |
| 1.5 | What was the duplicate "shareable configurable score cards" bullet? | Three distinct concepts: **Score Card** (input), **Rating Card** (shareable output), **Template** (shareable packaged setup). | The "duplicate" was really about sharing setups, i.e. community Templates. |
| 1.6 | What is v1's scope? | **The solo loop first.** Social concepts shape the model now but are implemented later. | The solo loop is useful with zero users (cold start). The model must not need tearing up when social features arrive. |
| 1.7 | Which platform? | Settled in 2.8, 3.7 and 4.8: mobile-first via Expo, plus Next.js for the API and web. | |

## Round 2: Structure and rating shape

| # | Question | Decision | Reasoning |
|---|---|---|---|
| 2.1 | How are manga issues, expansions, episodes handled? | **Items contain child Items.** The proposed one-level limit was **rejected**: a friend rates TV as Show › Season › Episode, with notes per episode. Depth is settled in 3.1. | Covers manga (series › volume), expansions, albums › tracks, TV. |
| 2.2 | How do different Items in a Collection get different rating fields (fiction vs non-fiction)? | **Option B: one Score Card with conditional fields.** Option A (multiple cards, one picked per Item) was rejected. | Set up once, then the right fields appear automatically, so users never think about which card applies. |
| 2.3 | What makes up an Overall Rating? | Fully configurable. The user rates however they want, with a configurable schema per Collection/Item. Refined in 3.4 and 5.1. | |
| 2.4 | Which number represents an Item in lists? | **Configurable per Collection** (refined in 3.5). | |
| 2.5 | Can scales be compared across Collections? | Acknowledged as hard. It needed brainstorming and was resolved in rounds 4–6 as the three-tier model. | |
| 2.6 | Who can be a Session Participant? | **Users or Guests.** A **Guest** is a named non-User owned by the logger, who can rate via the logger's phone and later be claimed by a real User. | Board game nights need this on day one. |
| 2.7 | Ownership status? | **Each Collection defines its own Status options** (seeded by its Template), or none at all. | A global list is too thin for board games and nonsense for beer. |
| 2.8 | Platform? | Leaning towards an Expo + Next.js monorepo. The developer knows Next.js, Prisma, rustfs and Postgres well. Kotlin was weighed against Expo; Expo was chosen because one codebase targets iOS and Android, while Kotlin is Android-only and would need Swift as well. | See [ADR 0001](../adr/0001-expo-and-nextjs-monorepo.md). |

## Round 3: Levels, Attributes, conditions

| # | Question | Decision | Reasoning |
|---|---|---|---|
| 3.1 | How deep can Items nest? | **A Collection declares named Levels** (Show › Season › Episode; Series › Volume; Game › Expansion; a single Level for beer). No hard depth limit. Every Item sits at one Level, with its parent at the Level above. | The structure is explicit, so the app always knows "Episode belongs to Season". It covers the TV spreadsheet case without accidental deep nesting. |
| 3.2 | Are descriptive and evaluative data separate? | **Yes.** **Attributes** (ABV, brewery, player count, genre) are separate from rating fields. **Attributes can also be conditional**, using the same mechanism as rating fields (raised by the user). | They behave differently: Attributes are mostly the same for everyone and filterable, while ratings are personal and change per Session. |
| 3.3 | Conditional rating fields? | **Yes. One card with conditional fields (B); A is dropped.** | |
| 3.4 | Overall vs Session forms? | **Each Collection Level configures an Overall form and a Session form** ("same as Overall" is allowed). This surfaced the opinion / result / observation distinction, resolved in 4.1. | A board game's overall opinion (replayability, art) differs from a Session (who won, how fun). Whisky may use the same form for both. |
| 3.5 | Which number represents the Item? | **Configurable per Collection.** Default: Overall Rating, falling back to the Session average. Options include latest Session, Participant average, and **the average of child Items** (seasons from episodes). | Whisky people may prefer "latest", and TV may prefer rolling up from episodes. |
| 3.6 | Cross-Collection comparison? | An ordinal bottom line was liked but not fully accepted. The user suggested comparability via Templates and suggested fields. Resolved in 5.1. | |
| 3.7 | Monorepo? | The user asked about the implications before deciding. Settled in 4.8. | |

## Round 4: Field Kinds, Sessions, offline

| # | Question | Decision | Reasoning |
|---|---|---|---|
| 4.1 | Kinds of field? | **Four Field Kinds: Attribute, Rating, Observation, Score.** "Score Card" was **renamed** to mean the game-score calculator (like Harmonies' score pad or the BG Stats calculators). Tasting notes (whisky notes, taste, complexity) are **Observations**, not ratings. | The kind decides what the app can do: Ratings feed averages and comparisons, Scores feed win/loss stats, Observations feed frequency stats, Attributes feed filters. |
| 4.2 | Who owns Session fields? | **Per Participant:** each person has their own Scores, Ratings and Observations. Notes and media can attach to the Session or to a Participant. (Extended by Addendum A, below.) | Tasting and scoring are individual, while shared photos belong to the Session. |
| 4.3 | What can conditions look at? | **Attributes only, never Tags.** Tags are free-form and ad hoc. | Renaming a Tag must never silently remove fields. |
| 4.4 | Score Card calculator design | **Parked as P1**, because the user prefers node-based editors. Resolved in round 7. | |
| 4.5 | Comparison model | The user asked for it to be spelled out. Resolved in 5.1. | |
| 4.6 | Bulk-creating child Items? | **v1: manual creation plus bulk generation** ("Season 2: 10 Episodes"). Importing from outside catalogs (TMDB, BGG, Open Library) comes later. | Bulk generation is cheap and works for every Collection. Each outside catalog is its own integration project. |
| 4.7 | Offline support? | **v1: logging queues offline** (Sessions and media are saved locally and synced later). Full offline-first browsing and editing is not in v1. | Logging is the moment that can't fail. Full offline sync is a major architectural commitment. Refined in slice 6: media queues as its own uploads, separate from the Session save. See [ADR 0008](../adr/0008-media-uploaded-separately-and-processed-on-device.md). |
| 4.8 | Monorepo layout? | **pnpm workspaces:** `apps/web` (Next.js + Prisma, API + web), `apps/mobile` (Expo), `packages/shared`. Docker Compose for Postgres and rustfs stays at the root. Typed RPC between the apps. | See [ADR 0001](../adr/0001-expo-and-nextjs-monorepo.md). |

### Addendum A (raised by the user during round 4)

A Session can optionally work like a **journal entry** (text, photos, audio), e.g. photos of the user and their wife with a board game in progress. A day at a brewery with friends contains **several Sessions** (one per beer), and that day is itself worth journaling. Resolved as **Occasion** in round 5.

## Round 5: Comparison tiers, Occasions, Tags

| # | Question | Decision | Reasoning |
|---|---|---|---|
| 5.1 | How are ratings compared? | **Three tiers (accepted):** (1) **Verdict**: every rating has one bounded, ordered bottom-line Rating, always present but pre-filled, converted to 0–1 for comparison, plus **percentile within the Collection**. (2) **Shared Field**: fields with a common identity and locked scale, comparable between users. (3) **Personal field**: compared only within your own data. Worked examples are in [scenarios.md](scenarios.md). | One universal scale isn't needed. The Verdict guarantees a minimum level of comparability, Shared Fields add opt-in detail, and percentile handles people who score narrow ranges. See [ADR 0004](../adr/0004-verdict-and-comparison-tiers.md). |
| 5.2 | Name of the multi-Session container? | **Occasion.** (Outing, Gathering and Event were rejected.) | Neutral: it fits a home game night, a brewery day, or a solo tasting flight. "Event" collides with code and calendars. |
| 5.3 | Is an Occasion required? | **Optional.** A Session belongs to at most one Occasion and can be grouped into one later. | Don't add a step to the most common action. Refined in slice 5: "at most one" is per User, because Occasions are personal and Sessions can be shared. See [ADR 0007](../adr/0007-occasion-links-belong-to-the-user.md). |
| 5.4 | Journal content | Explained further in round 6 and accepted there. | |
| 5.5 | Can an Occasion be empty? | **Yes.** An Occasion can be a standalone journal entry (text, photos and so on), with Sessions optionally attached, enabling a **Day One-style** revisit of everything you did. | User's call: this widens the product to include journaling. |
| 5.6 | Occasion Participants? | **Occasion Participants become the defaults for each new Session in it**, editable per Session. | |
| 5.7 | What can be tagged? | **Items, Sessions and Occasions.** | Unlocks metrics like "everything I tasted on vacation" without a new concept. |

Tags were confirmed as ad-hoc, free-form groupings that cut across Collections and never drive logic.

## Round 6: Verdict, journaling, Labels

| # | Question | Decision | Reasoning |
|---|---|---|---|
| 6.1 | Name for "Headline"? | **Verdict.** (Bottom Line, Grade and Mark were rejected.) Overall Rating was reworded to "standing opinion" to avoid a collision. | |
| 6.2 | Is the journal its own object? | **No.** Notes and media attach to an **Occasion**, a **Session**, or a **Participant within a Session**. The "journal" is a **timeline screen** that gathers them. | Avoids duplicating three attachment points under a fourth concept. |
| 6.3 | "On this day"? | **In v1.** | Cheap, loved in journaling apps, and brings people back without social features. |
| 6.4 | Location? | **Optional and one-tap** (suggested, never captured silently) and **private by default**, even when the Collection is shared. | Safety: a shared feed must not leak where people are. |
| 6.5 | What does a Label point to? | **One Item** (not a Catalog Entry). **What scanning does is configurable per Collection**: start a Session (pre-filled with date, open Occasion, usual Participants) or open the Item. | User's refinement: some Collections want logging, others want lookup. |
| 6.6 | Someone else scans your Label? | **v1:** the public Item page if the Collection is shared, otherwise a minimal "this belongs to …" page. **Social phase:** a User can **join or log the Session from their own account**. | Joining needs accounts, follows and permissions first. |
| 6.7 | Label formats? | **v1: printable PDFs** (standard sticker-sheet grids plus a few ex libris designs). A configurable Label designer comes later. | |
| 6.8 | Item leaves your hands? | **The Label stays tied to your Item** and scanning shows its Status (e.g. "Sold"). Transferring a Label comes in the social phase. | Your history shouldn't move because the box did. Refined in slice 7: a Label is its own record with an opaque code on a neutral, permanent Label domain. See [ADR 0009](../adr/0009-labels-encode-an-opaque-code-on-a-neutral-domain.md). |

## Round 7: Social model, metrics, Templates, Catalog

| # | Question | Decision | Reasoning |
|---|---|---|---|
| 7.1 | Collection Visibility? | **Private / Followers / Public per Collection.** Items, Sessions and Overall Ratings inherit it, with a per-Item "hide" override. Guest names are never public (shown as "+2 guests"). | One switch per Collection is easy to understand. |
| 7.2 | Occasion Visibility? | **Private by default, with its own setting, configured as an account-wide user preference** for journal and Occasion content (user's refinement). A public Session inside a private Occasion appears without the Occasion's notes, media or Participants. | Your diary shouldn't leak because one beer in it was public. |
| 7.3 | Following? | **One-way follow, with Collections followed opt-in one at a time.** Following someone shows *nothing* until you pick Collections (user's refinement: "I just want Jon's books, not his tinned fish"). Accounts can optionally require approval. | |
| 7.4 | Household sharing? | **Shared Collections with Collection Members** (e.g. the user and their wife). Each member keeps their own Overall Rating and Verdict. **Included in v1.** | Avoids logging every game night twice, and Labels need one stable target. |
| 7.5 | What is a "Group"? | **Split into two concepts: Community and Club.** A **Community** is larger (e.g. a game store such as Seattle Dragon's Den) with members, a feed, events and stats, and can host Clubs. A **Club** is small and focused (a book club, a co-op gamers club, a TCG club) and can **stand alone or sit inside a Community**. "Play group" stats come from Participants; no concept is needed. "Group" is now a word to avoid. | |
| 7.6 | Challenges? | **A goal with criteria and a time window**, measured against Sessions and Items. **Personal Challenges in v1**, group Challenges later. | Solo fuel with zero users, and the same criteria engine serves group Challenges later. Refined in slice 8: criteria are a per-Session match expression plus a fixed measure (Sessions, distinct Items, first-time Items, Items with at least k Sessions), and missing opinions make a Session *pending*. See [ADR 0010](../adr/0010-challenges-are-a-match-expression-plus-a-fixed-measure.md). |
| 7.7 | Metrics in v1? | **A fixed set:** activity heatmap; breakdowns by Tag, Attribute and Status; Verdict distribution and top Items by percentile; most frequent Observations; Score Card stats (win rate, bests, category averages). Custom dashboards come later. | Each metric comes from a Field Kind. |
| 7.8 | Adopting a Template? | **Copy into the Collection; later Template updates are offered, never forced.** Shared Fields keep their identity. | A live link would let someone else's edit change your rating form. Refined in slice 9: Templates are published from a source Collection as immutable versions; adoption copies with fresh ids and origin keys; updates are offered per property by a three-way comparison, keeping your edits by default. See [ADR 0011](../adr/0011-templates-are-published-snapshots-adopted-as-copies-with-origin-keys.md). |
| 7.9 | Where do Catalog Entries come from? | **No Catalog in v1.** Later: **Templates that bundle Catalog Entries** and **imports from outside catalogs** (BGG, Open Library, TMDB). Users never create Catalog Entries directly. | User-created entries are where duplicates and spam come from. |
| 7.10 | Rating Cards in v1? | **Yes.** Shareable image or public web link. | Free marketing for a product with no network yet. |

## Round 8: Social details and Template governance

| # | Question | Decision | Reasoning |
|---|---|---|---|
| 8.1 | Someone you follow starts a new Collection? | **Not auto-followed.** A one-time nudge ("Jon started Vinyl. Follow it?"). **Following someone's journal (Occasions) is its own opt-in.** | Consistent with following nothing by default. |
| 8.2 | What's shared in a household Collection? | **Shared:** Items, Attributes, Status, Labels, Sessions. **Personal:** Overall Ratings, Verdicts, Tags. | You own and play together, but opinions are personal. Tags span all of a person's Collections. |
| 8.3 | A Collection Member leaves? | **The leaving member gets a copy** of the Collection as it stood, including Sessions they took part in and their ratings. The original stays with the remaining members, along with its Labels. | Nobody loses history, and Labels need a stable target. |
| 8.4 | Community scheduled events? | **Meetup.** Hosted by a Community or Club. Attending (RSVP or check-in) creates the attendee's own **Occasion linked to it**. A book club's monthly meeting is a Meetup. | Distinct from personal Occasions, and avoids "Event". |
| 8.5 | Where do Community stats come from? | **Only Sessions inside Occasions linked to that host's Meetups.** Location doesn't count, and neither does everything a member logs. | Explicit, consensual, and respects Visibility. |
| 8.6 | Clubs owning Collections? | **Yes** (e.g. "Books We've Read"). Club Challenges run against it. The user asked whether Club Items also appear in personal Collections, which was resolved with **Linked Items** in 9.1. | Reuses Collection Members and Challenges. |
| 8.7 | Roles? | **Owner / Admin / Member.** Joining is open, approval-required or invite-only. Only Community Admins create Clubs inside a Community. Anyone can create a standalone Club. | |
| 8.8 | Who creates Shared Fields? | **Only Official (curated) Templates create Shared Fields for now.** Community Templates, with contributor rankings, come later. | Prevents fifty different "Peat" fields at launch. Refined in slice 9: Shared Fields are minted when a curator publishes, are never edited, and a copied field loses its identity only by an explicit Detach. See [ADR 0011](../adr/0011-templates-are-published-snapshots-adopted-as-copies-with-origin-keys.md). |

## Round 9: Club picks and the calculation model (P1 resolved)

| # | Question | Decision | Reasoning |
|---|---|---|---|
| 9.1 | Club pick vs your personal Item? | **Linked Items.** The Club's Item holds meeting Sessions and discussion. Adding it offers "Add to your Books?", which creates *your* Item linked to it. You rate once on your own Item, the Club sees your Verdict, and club Sessions show in your Item's history. | Preserves one home Collection per Item, and Verdict comparability does the rest. |
| 9.2 | One calculation model? | **Yes.** Score Card totals, calculated Verdicts, conditional fields and Challenge criteria share **one expression model**: a tree of inputs and operations stored as data, which any editor views. | See [ADR 0002](../adr/0002-one-expression-model.md). |
| 9.3 | Which editor in v1? | **The node editor is in v1** (user's preference, overriding the "simple form first" recommendation). | |
| 9.4 | Building blocks? | **Arithmetic, multipliers, min/max, powers, lookup tables** (e.g. Ticket to Ride route points, 7 Wonders science). Comparing players was explained further in round 10. | |
| 9.5 | Rounds? | **Yes.** Fields can be per-**Round** (golf holes, Cribbage hands), entered each Round and summed. A fixed or open-ended number of Rounds. | |
| 9.6 | Win rules? | **Highest wins / lowest wins / co-op win or lose / team-based (Teams) / no winner**, plus an **ordered list of tiebreaker fields**. | |

## Round 10: Editor placement, comparing players, data portability

| # | Question | Decision | Reasoning |
|---|---|---|---|
| 10.1 | Where does the node editor run? | **Web only in v1** (`apps/web`). The phone fills in Score Cards and shows a read-only graph. Mobile editing comes later. | Node editing on a phone is painful. Score Cards are built at a desk and filled in at the table. |
| 10.2 | Comparing players in v1? | **Yes. The node graph can see every Participant's columns.** [rank among Participants] ships in v1 (Longest Road, majority bonuses, Wingspan round goals). | The editor is in v1 anyway, so it's one more node type. |
| 10.3 | Broken graphs? | **Loops can't be saved.** Missing or invalid inputs show a visible **incomplete** total ("needs Trees for Sam"), never a wrong number. | A silently wrong winner is worse than an honest gap. |
| 10.4 | Import/export? | **v1: CSV import with column → field mapping** (including creating Items across Levels, for the TV spreadsheet case) **plus full export** (CSV and JSON, media included). App-specific importers (BG Stats, Untappd, Goodreads) come later. | Onboarding from spreadsheets, and trust for years of hobby data. |
| 10.5 | Pricing? | **Out of scope for this session.** The model records **media size per user** so limits can be added later. | Needs its own session. |

## Round 11: Multi-person Sessions

| # | Question | Decision | Reasoning |
|---|---|---|---|
| 11.0 | Clarification | "Each Participant's sheet" means **their column in the one Score Card for that Session**, not their phone. One phone can enter everyone's columns. | The user's concern: not everyone uses the app. |
| 11.1 | One phone enters everything? | **Yes.** Totals that compare players stay incomplete until every column they need is filled. | The day-one game night flow. |
| 11.2 | Expansions in a Session? | **A Session is about one Item, plus optional child Items of that Item marked as "used".** The Score Card adds fields through conditions when an expansion is used. | Expansion play counts work, and multi-Item Sessions aren't needed. A whisky flight is several Sessions in one Occasion. |
| 11.3 | Sessions with other Users (social phase)? | The Session **lives in the logger's Collection** and appears in each User Participant's history, with an offer to create a **Linked Item**. Participants edit **only their own** Ratings, Observations and notes. **Scores** are edited by the logger, or by a participant for their own column from their own phone. | Opinions belong to the person, and the table record belongs to the logger. |
| 11.4 | Editing in household Collections? | **Any Collection Member** can edit a Session's shared parts (date, Participants, Scores, Session notes). Personal Ratings and Observations are editable only by their owner. | Whoever holds the phone logs the game. |

---

## Deferred to their own sessions

- **Product name.** "Curate & Critique" is being retired for marketing reasons, and "Curate" is a placeholder.
- **Pricing and monetization** (media storage limits, feature gates).

See [open-questions.md](open-questions.md) for everything else deliberately left open.
