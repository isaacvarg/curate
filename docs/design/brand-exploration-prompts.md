# Brand exploration prompts

Prompts for step 1 (Explore) of [#49](https://github.com/isaacvarg/curate/issues/49): one brief, one sample content sheet, and a prompt each for Google Stitch, `design-taste-frontend` (tasteskill v2) and Figma Make. Every tool gets the same brief, directions, screens and content, so the outputs differ only in how each tool reads them. You pick the look; the tools only propose. DESIGN.md is then written from the chosen direction.

Terms in **bold** are defined in [GLOSSARY.md](../../GLOSSARY.md).

| Tool | Job | Output |
|---|---|---|
| Google Stitch + `/stitch-design-taste` | Explore the three directions broadly | Six phone screens per direction, plus a draft DESIGN.md |
| `design-taste-frontend` | Art-direct and critique; check contrast and slop in a real browser | Static HTML prototypes: six phone screens × three directions × light and dark |
| Figma Make | Show how Figma interprets the brief, on phone and desktop web | Six phone screens and three web screens per direction |

Later, optionally: push the HTML prototypes into a Figma file through the Figma MCP so all three tools sit side by side.

---

## 1. Shared brief

Paste this block into every prompt.

```text
PRODUCT
curate is a personal app for collecting, rating and journaling hobbies: board games, beer, books, tinned fish, TV. Solo use comes first. It's used one-handed at the table, mid-game or mid-tasting, on iOS and Android (Expo). A Next.js web app holds the node editor and public pages. "curate" is a placeholder name.

PERSONALITY
Quiet editorial: calm, mindful, unhurried. But it's a hobby you keep for yourself, not a gallery or a bank, so it's never sterile or clinical. Think a beautifully set catalogue of your own life. The user's photos and their hobbies' colours are the most colourful things on screen; the interface frames them and steps back.

IDENTITY
No logo or symbol work. The only mark is the word "curate", lowercase, set in the display serif. Brand the system, not the name.

COLOUR
- Neutrals are warm: a warm off-white (stone/oatmeal) in light mode, a warm charcoal in dark mode. Text is ink, never pure #000 or #FFF.
- The primary colour is ink (the near-black text colour): primary buttons, navigation, focus. There is no brand hue.
- Colour comes from Collection accents: each Collection has one accent from a curated set of about 8 muted hues (for example amber for Beers, moss for Board Games, slate blue for Books, coral for Tinned Fish, plum for TV). The accent tints that Collection's header, chips, filled Verdict and highlights.
- Accents are swappable (users will pick their own hex later), so no design may depend on one particular hue. Every accent has a light-mode and a dark-mode value, and both pass WCAG AA against the surfaces they sit on.
- Light and dark mode are equals, following the system setting.

TYPE
Two typefaces at most, both from Google Fonts:
- a serif for display: Item names, screen titles, Journal headings, large Verdict numbers;
- a sans for the interface, with tabular figures: controls, Attributes, Scores, metadata.
Not Inter, Roboto, Arial or system defaults. Example pairings: Newsreader + Geist, Fraunces (low softness) + Instrument Sans, Source Serif 4 + IBM Plex Sans.

SHAPE AND DEPTH
Flat. Separate things with hairline borders, spacing and slight tone shifts, not shadows. Radius about 12 on cards and photos, about 8 on fields, pills for chips. Shadows only on things that float: bottom sheets, menus.

PHOTOS
User photos are large, full-width on Item and Journal screens, with one consistent radius. No filters, gradients or text over a photo; text sits beside or below it.

ICONS AND MOTION
One thin-stroke icon set (Phosphor Light or Lucide at 1.5px), never filled, never emoji in the UI. A little purposeful motion is welcome: the Verdict fills smoothly as it's set, Score totals tick up when they change, sheets settle with a soft spring without overshoot. Respect reduced motion.

ERGONOMICS (hard rules)
- One-handed: primary actions sit at the bottom, within thumb reach.
- Touch targets at least 48pt for the Verdict control and choice chips (44pt minimum elsewhere).
- Scores and every number that changes use tabular figures.
- An incomplete total is visibly different from a final number: it shows what it needs ("needs Round goals for Sam"), never a number that could be mistaken for the result.
- Unrated is visibly different from a low rating; it is never shown as 0 or one star.

COMPONENTS (use these names)
- Verdict control: the bottom-line rating. Three forms of one family. Stars: thin outline stars that fill with the Collection accent, half steps by sliding, 48pt per star. Numeric (/10, /100): a large serif number with a stepper or slider below. Ordered labels (tiers, thumbs): a segmented row of pills. Each step gives a light haptic tick. Clear unrated state.
- Rating field row: one opinion field (label, its scale, its value) in a list; a small badge marks a Shared Field.
- Choice chips: pill chips for Observations (tasting notes) and multiple choice; selected chips fill with the Collection accent.
- Condition-builder row: "when [Attribute] [is] [value]", with all of / any of; it lives in settings and needs only a component spec, not a screen.

VOICE
Plain, warm, second person. Use the product's own words exactly: Collection, Item, Session, Occasion, Verdict, Participant, Guest, Journal, Score Card, Observation, Rating Card. Never "check-in", "log entry", "score" for an opinion, or "event". No cheerleading ("Awesome! 🎉"), no streaks or guilt.

LABELS (rule only, nothing to draw)
Printed QR Labels and ex libris are monochrome, so they print on any printer.
```

## 2. The three directions

All three use the shared brief. They are three temperaments of one personality, not three personalities.

```text
DIRECTION 1 — STONE & INK
Light-led. Oatmeal paper, deep ink text, a crisp high-contrast serif, generous air and strict alignment. Like a gallery catalogue of your hobbies. Dark mode is a faithful inversion: warm charcoal, ink becomes warm off-white.

DIRECTION 2 — LINEN & MOSS
Softer and more "hobby". Neutrals slightly warmer and greener, a rounder humanist serif, a touch more texture in spacing and rhythm. Like a well-kept field journal. Still flat, still quiet.

DIRECTION 3 — NIGHT TABLE
Dark-led, for a bar or a game table at night. Warm charcoal surfaces, ink with a faint brass warmth, low glare, accents slightly deepened. Its light mode is derived from the dark one rather than the other way round.
```

## 3. Screens

### Phone (every tool)

1. **Collections home.** The user's Collections as a list, each with its accent, Item count and the latest activity. The Open Occasion "Brewery day" is pinned at the top with a way to end it. The primary action (log a Session) is at the bottom.
2. **Item: Wingspan.** A large photo, then Attributes (players 1–5, 40–70 min, Status: Owned), the Overall Rating (the Verdict control in stars, plus Rating field rows: Replayability and Components are Shared Fields, "Good with 2 players" is personal), "top 10% of your games", child Items (European Expansion), and recent Sessions.
3. **Log Session (tasting).** Hazy IPA inside the open Occasion "Brewery day". Participants You and Alex (Sam left early and has been removed). For each Participant: Observation chips (citrus, pine, haze, bitter), a Verdict, and a short note. One-handed, with the save button at the bottom.
4. **Score Card: Wingspan.** European Expansion marked as used. Columns for You, Alex and Guest Sam, entered on one phone. Category rows: Birds, Bonus cards, Round goals, Eggs, Cached food, Tucked cards. Round goals are ranked among Participants and show incomplete until Sam's column is filled ("needs Round goals for Sam"). Live totals in tabular figures, and a placement strip that says "incomplete" until every column is in.
5. **Journal.** A timeline of Occasions containing their Sessions and Media: "Brewery day" with three beers and photos, and a game night with a Wingspan Session. An "On this day" card from a year ago sits at the top.
6. **Rating Card.** One square image to share: Piranesi, the Verdict ★★★★½, two chosen fields, a short note, one photo, and the small "curate" wordmark.

### Desktop web (Figma only)

7. **Item page:** Wingspan, the web version of screen 2.
8. **Public Rating Card page:** the `/r/<code>` page for the Piranesi card. It shows only what's on the card, with a quiet "made with curate" link at the bottom.
9. **Score Card node editor:** building the Wingspan Score Card as a node graph (input fields → sum → rank among Participants → total), with a side panel for the selected node. This is where quiet editorial is most likely to break down; keep it calm.

## 4. Sample content

Use exactly this content in every tool.

```text
USER: You. Household Collection Member: Alex (your partner). Guest: Sam.

COLLECTIONS (accent · Items · latest)
- Board Games (moss) · 64 Items · Wingspan, 2 days ago
- Beers I've Had (amber) · 212 Items · Hazy IPA, today
- Books (slate blue) · 148 Items · Piranesi, last week
- Tinned Fish (coral) · 31 Items · Ati Manel Sardines in Olive Oil, 3 weeks ago
- TV (plum) · Show › Season › Episode · 19 shows · Severance S2E4, yesterday

OPEN OCCASION: "Brewery day", today, started 1:40 pm at Fremont Brewing (location private), Participants You, Alex, Sam. 3 Sessions so far.

ITEM: Wingspan (Board Games, Level: Game)
- Attributes: Players 1–5 · 40–70 min · Designer Elizabeth Hargrave · Status: Owned
- Overall Rating: Verdict ★★★★½ (of 5) · Replayability 5/5 (Shared) · Components 4/5 (Shared) · Good with 2 players 4/5 (personal)
- Top 10% of your games · 23 Sessions · You win 52%
- Child Item: European Expansion (Expansion), used in 9 Sessions

SCORE CARD SESSION: Wingspan + European Expansion, Saturday game night
            You   Alex   Sam
Birds        38    41     33
Bonus cards   7     4      9
Round goals  ranked among Participants: You 1st, Alex 2nd, Sam — not entered
Eggs         12     9     14
Cached food   4     6      2
Tucked cards  8     3      5
Total: incomplete — needs Round goals for Sam

TASTING SESSION: Hazy IPA, Fremont Brewing (Beers I've Had), in "Brewery day"
- You: Observations citrus, pine, haze · Verdict ★★★★ · note "Juicy, soft finish, would order again."
- Alex: Observations citrus, bitter · Verdict ★★★½

JOURNAL
- On this day, one year ago: "Lisbon tins" Occasion — 4 tinned fish Sessions, 6 photos
- Today: Brewery day — Hazy IPA ★★★★, Kölsch ★★★, Stout ★★★★½, 5 photos
- Saturday: Game night — Wingspan, You 1st, 2 photos

RATING CARD: Piranesi by Susanna Clarke (Books)
- Verdict ★★★★½ · Prose 5/5 (Shared) · Setting 5/5 (Shared)
- Note: "A house of endless halls and tides. Quietly devastating."
- One photo of the book on a windowsill
```

---

## 5. Google Stitch prompt

Run it with `/stitch-design-taste` (install it from `Leonxlnx/taste-skill-classics`, as #49 describes, and read its SKILL.md first), or paste it straight into [Stitch](https://stitch.withgoogle.com). Run it once per direction so each direction gets its own project.

```text
Design a mobile app (iOS and Android, 390×844) in this direction: [paste ONE direction from section 2].

[paste the shared brief from section 1]

Screens, in this order, using exactly the sample content below:
1. Collections home  2. Item: Wingspan  3. Log Session (tasting)  4. Score Card: Wingspan  5. Journal  6. Rating Card (square)
[paste the phone screen descriptions from section 3]

[paste the sample content from section 4]

Produce every screen in light and in dark mode. Keep one design system across all six screens: same type scale, spacing, radii and components. Show at least two different Collection accents (moss on Wingspan screens, amber on the tasting screen) so it's clear accents are swappable.

Then write a DESIGN.md for the direction in Google's DESIGN.md format (https://github.com/google-labs-code/design.md), sections in this order: Overview, Colors, Typography, Layout, Elevation, Shapes, Components, Do's and Don'ts. Define light and dark colour tokens, the 8 Collection accents as light/dark pairs, the type scale, spacing, radii, and component tokens for the Verdict control (all three forms), Rating field rows, choice chips and the condition-builder row. Explain the reasoning behind each choice. Use the product's own words from the brief.
```

## 6. design-taste-frontend prompt

For Claude Code, using `design-taste-frontend`'s app-screens path. Run it in a fresh session at the repo root.

```text
/design-taste-frontend

I want static HTML prototypes to choose curate's brand direction (issue #49). This is app screens, not a landing page, so use your app-screen run and rules. Read docs/design/brand-exploration-prompts.md in full first. It holds the brief, the three directions, the screens and the sample content. Also read GLOSSARY.md.

Build the six phone screens (section 3, screens 1–6) in each of the three directions (section 2), with the sample content from section 4, word for word.

- Output: scratch/brand-exploration/<direction>/index.html, one file per direction, showing all six screens in 390×844 phone frames, with a light/dark toggle. Plus scratch/brand-exploration/index.html linking the three. Plain HTML and CSS, with Google Fonts the only external resource. No frameworks.
- Write each direction's tokens once as CSS custom properties at the top of its file (neutrals light and dark, the 8 Collection accents as light/dark pairs, type scale, spacing, radii), and use only those tokens below them. That token block becomes the starting point for DESIGN.md.
- The rules in the brief's ERGONOMICS and COMPONENTS sections are hard rules. In particular: the incomplete total on the Score Card, the unrated vs. low Verdict states, 48pt Verdict and chip targets, and tabular figures.

Then act as art director:
1. Inspect every screen in a real browser in light and dark. Fix contrast below WCAG AA, anything that looks templated or "AI-made", and anything that breaks the brief, until each direction passes your own review.
2. Swap the Board Games accent for every other accent once and check that nothing breaks.
3. Write scratch/brand-exploration/REVIEW.md: for each direction, a short critique (what it does well, where it's weak, how it holds up at the dense Score Card and in dark mode), its token block, and your ranking with reasons. Recommend, but don't choose; I choose.

Don't write DESIGN.md or touch packages/ yet.
```

## 7. Figma Make prompt

Paste this into [Figma Make](https://www.figma.com/make/), once per direction. It covers phone and desktop web, so you can see how Figma reads the brief on both.

```text
Design a hobby-tracking app called "curate" in this direction: [paste ONE direction from section 2].

[paste the shared brief from section 1]

Make a design system first: colour styles (light and dark neutrals, ink, the 8 Collection accents as light/dark pairs), text styles for the serif and sans scale, spacing and radius variables, and components: Verdict control (stars, numeric and ordered-labels variants, each with an unrated state), Rating field row (with and without the Shared Field badge), choice chip (default and selected), condition-builder row, list row, primary and secondary button, bottom sheet. Use variables and modes for light and dark.

Then build these frames with that system, using exactly the sample content below:

PHONE (390×844), light and dark:
[paste screens 1–6 from section 3]

DESKTOP WEB (1440×900), light and dark:
[paste screens 7–9 from section 3]

[paste the sample content from section 4]

On the phone, keep primary actions at the bottom, in thumb reach. On desktop, use the extra width for calm, generous layouts, not more density. Show at least two Collection accents, so it's clear accents are swappable.
```

---

## After exploring

1. Put the three tools' outputs side by side (optionally have Claude push the HTML prototypes into one Figma file) and pick one direction, borrowing from the others if you like.
2. Continue #49 from step 2 (Refine): settle the palette in Realtime Colors in light and dark, then write DESIGN.md, lint it and generate the tokens.
