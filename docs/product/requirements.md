# System Requirements

Testable requirements derived from the design session. Terms in **bold** are defined in [GLOSSARY.md](../../GLOSSARY.md). IDs are stable, so you can cite them in issues and PRs.

**Priority:** `v1` must ship in the first release. `Social` is the social phase. `Later` is unscheduled. Model requirements marked **(model)** must be met by the v1 data model even if the feature ships later.

---

## 1. Collections and Items

- **FR-1.1** (v1) A User can create a **Collection**, either blank or by adopting an Official **Template**.
- **FR-1.2** (v1) A Collection declares an ordered list of named **Levels**. There is no hard depth limit, and the minimum is one Level.
- **FR-1.3** (v1) Every **Item** belongs to exactly one Collection and sits at exactly one Level. An Item at Level *n* > 1 has exactly one parent Item at Level *n − 1* in the same Collection.
- **FR-1.4** (v1) A User can bulk-generate child Items under a parent (e.g. "10 Episodes").
- **FR-1.5** (v1) Each Level defines **Attributes**. An Attribute can be conditional on other Attributes' values.
- **FR-1.6** (v1) Each Collection defines zero or more **Status** options, and an Item has at most one Status.
- **FR-1.7** (v1) Items, Sessions and Occasions can carry any number of **Tags**. Tags belong to the User and work across Collections. Tags never affect which fields appear.
- **FR-1.8** (model) An Item can optionally reference one **Catalog Entry**. The link never overrides the Item's own data.
- **FR-1.9** (model) An Item can be a **Linked Item** of an Item in another Collection. Verdicts are readable across the link.
- **FR-1.10** (Later) Catalog Entries come only from Template bundles or imports from outside catalogs. Users can't create them directly.

## 2. Fields and rating

- **FR-2.1** (v1) Every configurable field has exactly one **Field Kind**: Attribute, Rating, Observation or Score.
- **FR-2.2** (v1) Each Level configures an Overall form and a Session form. The Session form may be declared "same as Overall".
- **FR-2.3** (v1) Every Overall form and Session form has exactly one **Verdict** field. It's a Rating on a bounded, ordered scale (numeric range or ordered labels such as tiers or thumbs). New Collections get a pre-filled default ("Overall ★1–5") that can be renamed and rescaled.
- **FR-2.4** (v1) A Verdict is either entered by hand or calculated by an expression over other fields on the same form.
- **FR-2.5** (v1) Rating, Observation and Attribute fields can be conditional. Conditions may only reference Attributes.
- **FR-2.6** (v1) An Item has at most one **Overall Rating** per User.
- **FR-2.7** (v1) Each Collection configures which value represents an Item: the Overall Verdict, the Session average, the latest Session, the Participant average, or the average of child Items. Default: Overall Verdict, falling back to the Session average.
- **FR-2.8** (v1) Every Verdict converts to a 0–1 value. The system can compute any Verdict's percentile among the same User's Items at the same Level in the same Collection.
- **FR-2.9** (v1) Cross-Collection rankings ("top things this year") use percentile.
- **FR-2.10** (model) A **Shared Field** has a global identity and a locked scale. Only Official Templates define Shared Fields. Values are comparable between Users only through the same Shared Field.
- **FR-2.11** (model) Fields defined by Users are never compared between Users.

## 3. Sessions

- **FR-3.1** (v1) A **Session** is about exactly one Item, and may mark child Items of that Item as "used".
- **FR-3.2** (v1) A Session has zero or more **Participants**, each either a User or a **Guest**. A Guest is owned by the User who created it.
- **FR-3.3** (v1) Ratings, Observations and Scores in a Session are recorded per Participant.
- **FR-3.4** (v1) One device can enter every Participant's values.
- **FR-3.5** (v1) Notes and media can attach to an Occasion, a Session, or a Participant within a Session.
- **FR-3.6** (v1) Media types: photo, video (up to 2 minutes), voice memo (up to 10 minutes). Media is processed on the phone and uploaded separately from the Session or Occasion it belongs to ([ADR 0008](../adr/0008-media-uploaded-separately-and-processed-on-device.md)). The system records the total media size per User.
- **FR-3.7** (v1) In a shared Collection, any **Collection Member** can edit a Session's shared parts (date, Participants, Scores, Session notes). Per-person Ratings and Observations are editable only by the person they belong to.
- **FR-3.8** (Social) A Session appears in the history of every User Participant, with an offer to create a Linked Item in their own Collection.
- **FR-3.9** (Social) A User Participant can edit their own Ratings, Observations and notes, and can enter their own Score column from their own device.
- **FR-3.10** (Social) A User can claim a Guest, taking over that Guest's history.

## 4. Score Cards and expressions

- **FR-4.1** (v1) Score Card totals, calculated Verdicts, field conditions and Challenge criteria all use one expression model, stored as data ([ADR 0002](../adr/0002-one-expression-model.md)).
- **FR-4.2** (v1) Supported operations: arithmetic, multipliers, min/max, powers, lookup tables, comparisons, and [rank among Participants].
- **FR-4.3** (v1) An expression in a Session can read every Participant's inputs.
- **FR-4.4** (v1) Score fields may be per-**Round**, with a fixed or open-ended number of Rounds. Per-Round values are summed.
- **FR-4.5** (v1) Win rule: highest wins, lowest wins, co-op win/lose, team-based (**Teams**), or no winner. There is also an ordered list of tiebreaker fields.
- **FR-4.6** (v1) Expressions that loop can't be saved.
- **FR-4.7** (v1) A result whose inputs are missing or invalid is shown as *incomplete* and names what it needs. It is never shown as a number.
- **FR-4.8** (v1) The node editor runs on web. Mobile shows Score Cards for data entry and a read-only graph.
- **FR-4.9** (v1) Expressions are evaluated by the same shared code on mobile (including offline) and on the server.

## 5. Occasions and journal

- **FR-5.1** (v1) An **Occasion** is a dated entry with optional notes, media, Participants, location and Tags. It may contain zero or more Sessions.
- **FR-5.2** (v1) A Session belongs to at most one Occasion per User, and can be moved into or out of one at any time. Grouping is the Occasion owner's, so a shared Session can sit in each person's own Occasion ([ADR 0007](../adr/0007-occasion-links-belong-to-the-user.md)).
- **FR-5.3** (v1) New Sessions in an Occasion default to the Occasion's Participants.
- **FR-5.4** (v1) The journal is a timeline view built from Occasions, Sessions and their notes and media.
- **FR-5.5** (v1) An "On this day" view shows content from the same date in past years.
- **FR-5.6** (v1) Location is optional. It's suggested, never captured silently, and private by default.
- **FR-5.7** (v1) A User has at most one **open Occasion**. New Sessions join it by default and start with its Participants. Backdated Occasions are never open.

## 6. Labels

- **FR-6.1** (v1) Each Item can generate a **Label** whose QR code encodes a stable https URL identifying that Item: an opaque code on a product-neutral Label domain ([ADR 0009](../adr/0009-labels-encode-an-opaque-code-on-a-neutral-domain.md)).
- **FR-6.2** (v1) Each Collection configures the owner's scan action: start a Session (pre-filled with date, open Occasion and usual Participants) or open the Item.
- **FR-6.3** (v1) Scanning without the app opens a web page. With the app installed, a universal link opens the app.
- **FR-6.4** (v1) A non-owner sees the public Item page if the Collection's Visibility allows it, otherwise a minimal ownership page. In v1 Collection Visibility is stored as Private only, so everyone else sees the minimal page (Item name, Status, and the owner's name only if they opt in). The public Item page arrives with Visibility in the social phase.
- **FR-6.5** (v1) Labels are exported as printable PDFs: sticker-sheet grids and ex libris designs.
- **FR-6.6** (v1) A Label stays tied to its Item for life and shows the Item's current Status.
- **FR-6.7** (Social) A non-owner User can join or log the Session from their own account.

## 7. Metrics and Challenges

- **FR-7.1** (v1) Activity heatmap of Sessions and Occasions.
- **FR-7.2** (v1) Breakdowns by Tag, Attribute and Status.
- **FR-7.3** (v1) Verdict distribution and top Items by percentile, within and across Collections.
- **FR-7.4** (v1) Most frequent Observation values.
- **FR-7.5** (v1) Score Card stats: win rate per Participant, best scores, category averages.
- **FR-7.6** (v1) Personal **Challenges**: a match expression, a measure, a target and a time window, with progress tracking ([ADR 0010](../adr/0010-challenges-are-a-match-expression-plus-a-fixed-measure.md)).
- **FR-7.7** (Social) Club and Community Challenges.

## 8. Templates and sharing

- **FR-8.1** (v1) Adopting a Template copies its Levels, Attributes, fields, Score Cards, Statuses and scan action into the Collection.
- **FR-8.2** (v1) Template updates are offered to adopting Collections and never applied automatically.
- **FR-8.3** (v1) Fields copied from Shared Fields keep their Shared Field identity, and their scale can't be changed.
- **FR-8.4** (v1) **Rating Cards**: the User picks which fields and media to include and gets a shareable image and a public web link.
- **FR-8.5** (Later) Community Templates with contributor rankings. They can use Shared Fields but not create them.

## 9. Sharing, Visibility and social

- **FR-9.1** (v1) A Collection can have several Collection Members. Shared: Items, Attributes, Status, Labels, Sessions. Personal: Overall Ratings, Verdicts, Tags.
- **FR-9.2** (v1) A member leaving a shared Collection gets a full copy of it as it stood, including the Sessions they took part in and their ratings. The original and its Labels stay with the remaining members.
- **FR-9.3** (model) Each Collection has a **Visibility** (Private / Followers / Public), inherited by its Items, Sessions and Overall Ratings, with a per-Item hide override.
- **FR-9.4** (model) Each User has an account-wide Visibility for Occasion and journal content, Private by default. A visible Session inside a hidden Occasion never reveals the Occasion's notes, media or Participants.
- **FR-9.5** (model) Guest names are never shown outside the owner's own view.
- **FR-9.6** (Social) A **Follow** is one-way and covers specific Collections. Following a User subscribes to nothing until Collections are chosen. Journal following is a separate opt-in. Accounts may require follow approval.
- **FR-9.7** (Social) When a followed User creates a Collection, followers get a one-time prompt and are not auto-subscribed.
- **FR-9.8** (Social) **Communities** and **Clubs** have Owner / Admin / Member roles and open, approval-required or invite-only joining. Clubs can be standalone or inside a Community, and only Community Admins can create the latter.
- **FR-9.9** (Social) Clubs can own Collections. Adding a Club Item offers creating a personal Linked Item.
- **FR-9.10** (Social) Communities and Clubs host **Meetups**. Attending creates the attendee's own Occasion linked to the Meetup.
- **FR-9.11** (Social) Community and Club stats include only Sessions in Occasions linked to their Meetups.

## 10. Data portability

- **FR-10.1** (v1) CSV import with column-to-field mapping, able to create Items across Levels.
- **FR-10.2** (v1) Full export of a User's data as CSV and JSON, media included.
- **FR-10.3** (Later) Importers for specific apps (BG Stats, Untappd, Goodreads).

---

## Non-functional requirements

- **NFR-1 Platform.** Mobile for iOS and Android via Expo. Web via Next.js. pnpm monorepo with `apps/mobile`, `apps/web` and `packages/shared` ([ADR 0001](../adr/0001-expo-and-nextjs-monorepo.md)).
- **NFR-2 Server stack.** Postgres via Prisma, used only from `apps/web`. rustfs for media storage. Local infrastructure through Docker Compose at the repo root.
- **NFR-3 API.** Mobile talks to the server only through the typed oRPC API. It never touches the database directly. Accounts use Better Auth ([ADR 0005](../adr/0005-orpc-and-better-auth.md)).
- **NFR-4 Offline logging.** Creating Sessions (including Score Card entry, ratings and media capture) works with no connection. Queued changes sync automatically when the connection returns, without data loss.
- **NFR-5 Shared logic.** Expression evaluation, Verdict normalization and condition logic live in `packages/shared` and give identical results on every client and the server.
- **NFR-6 Privacy by default.** New Occasions and locations are private. Guest names are never public. Location is never captured without a user action.
- **NFR-7 Stable Label URLs.** Label URLs must remain valid for the life of the Item, including after it's Sold, after a Collection Member leaves, and across domain or product renames. Labels are physical and can't be reprinted cheaply. See [ADR 0009](../adr/0009-labels-encode-an-opaque-code-on-a-neutral-domain.md).
- **NFR-8 Data ownership.** Users can export everything they've created, in open formats, at any time.
- **NFR-9 Media accounting.** Media storage is tracked per User so limits can be added later.
- **NFR-10 Correctness over guessing.** The app never displays a calculated result (score, winner, Verdict, Challenge progress) built from incomplete inputs as if it were final.
