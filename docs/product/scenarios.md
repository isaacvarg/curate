# Worked Scenarios

Concrete walk-throughs used during the design session to stress-test the model. If a future change breaks one of these, that change needs a decision. Terms in **bold** are defined in [GLOSSARY.md](../../GLOSSARY.md).

---

## 1. Comparison tiers in practice

Every field falls into exactly one tier:

1. **Verdict**: always comparable, via 0–1 conversion and percentile.
2. **Shared Field**: comparable between users, field by field.
3. **Personal field**: compared only within your own data.

### Board Games: Wingspan, from the Board Games Template

| Tier | Field | What it enables |
|---|---|---|
| Verdict | Overall ★1–10 | You 8/10 and Sam 4/5★ both convert, so the community average shows in *your* scale. Your yearly list: Wingspan is in your top 10% of games. |
| Shared | Replayability 1–5, Components 1–5 (Overall); Fun 1–5 (Session) | "Your Replayability 5 vs community 3.9" |
| Shared | Wingspan Score Card: birds, bonus, eggs, tucked… | "Your average Wingspan score 78 vs community 84", "your best category: eggs" |
| Personal | "Good with 2 players 1–5" | Only your own charts, like your top 2-player games |

### Manga: One Piece › Volume 61

| Tier | Field | What it enables |
|---|---|---|
| Verdict | ★1–5 at both Levels | Volume 61 is in your top 3% of **volumes**. Comparisons stay within a Level. |
| Shared | Art 1–5, Story 1–5 (Volume Level) | "Community thinks Vol. 61's art is a 4.8" |
| Personal | Hype 🔥1–3 | Your own hype-over-time chart for the series |

### Books: one form with conditional fields

| Tier | Field | What it enables |
|---|---|---|
| Verdict | ★1–5 for every book | Your top books of the year, and cross-Collection lists |
| Shared | Prose, Enjoyment (all books); Characters, Plot, Setting (only when Genre = Fiction) | "Your Plot rating vs community" for fiction. Non-fiction never shows Plot. |
| Personal | Cried? 0–3 | "Books that wrecked me" |

### Why percentile

You rate beer ★1–5 and whisky /100, but you only ever score whisky between 80 and 95. Converting to 0–1 says Lagavulin 92 → 0.92 and a 4★ beer → 0.75. Percentile says Lagavulin is in your **top 5%** of whiskies and the beer is in your top 20% of beers. Cross-Collection rankings use percentile, so each Collection is judged against your own habits for that Collection.

## 2. A friend's TV spreadsheet

The friend rates the whole show, each season and each episode, with notes per episode.

- The Collection "TV" declares Levels **Show › Season › Episode**.
- CSV import maps columns to Levels, creating the Show, Season and Episode Items.
- Each Episode has an Overall Rating and notes. Rewatches are Sessions.
- The Season's representative value can be set to "average of child Items" (its Episodes), or to its own Overall Rating.

## 3. Board game night at home

The user and their wife share the household Collection "Board Games" (**Collection Members**).

1. Scan the **Label** on the Wingspan box. The Collection's scan action is "start Session", so the date and usual Participants are pre-filled.
2. Mark the European Expansion (a child Item) as "used". Its extra Score Card fields appear through a condition.
3. Add Sam as a **Guest**.
4. One phone enters every Participant's column. The round-goal majorities use [rank among Participants], so totals show *incomplete* until every column is filled.
5. A photo of the board in progress attaches to the Session. Sam's comment attaches to Sam as a Participant.
6. Each person gives their own fun Rating and Verdict.
7. Wingspan's expansion play count increases. Win-rate stats update for everyone, including Sam.

## 4. Brewery day with friends

1. On arrival, create the **Occasion** "Brewery day", with the friends as Participants.
2. Log five beer Sessions inside it. Each defaults to the Occasion's Participants. One friend leaves early, so remove them from the last Session.
3. Each person records their own **Observations** (tasting notes) and Verdict per beer.
4. Group photos and the day's write-up go on the Occasion.
5. Location is suggested with one tap and stays private.
6. Next year, "On this day" brings it back.

## 5. Whisky tasting

The same form is used for Overall and Session. A Session records each Participant's Observations (nose: vanilla, oak; complexity) and a /100 Verdict. Collection metrics show "your most-detected notes". The Collection's representative value may be set to "latest Session", since bottles and palates change.

## 6. Book club pick (social phase)

1. The Club owns the Collection "Books We've Read". The *Piranesi* Item lives there.
2. Adding it offers "Add to your Books?", which creates your own **Linked Item**.
3. You rate it once, on your own Item and with your own form. The Club sees your Verdict through the link.
4. The monthly meeting is a **Meetup**. Attending creates your own Occasion linked to it, and the discussion Session shows in your Item's history.

## 7. Community stats (social phase)

Seattle Dragon's Den is a **Community** containing the co-op gamers **Club** and the TCG **Club**. "Most played games this month" counts only Sessions inside Occasions linked to Dragon's Den Meetups. Games members play at home never count, even if they live next door.

## 8. Following selectively (social phase)

You follow Jon and choose only his Books. His tinned fish never shows up. Jon starts "Vinyl" and you get a one-time prompt. Jon's journal is a separate opt-in.

## 9. Item leaves your hands

You sell Wingspan with the Label still on it. Its Status becomes "Sold". Anyone scanning the Label sees your Item page showing Sold. Your history stays with you.

## 10. Household split

One member leaves the shared "Board Games". They get a copy of the Collection as it stood, including the Sessions they took part in and their own ratings. The original, and the Labels on the physical boxes, stay with the remaining member.
