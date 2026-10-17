# Challenges are a match expression plus a fixed measure

A Challenge counts things over a time window: "10×10 in 2027" (10 different games, each played 10 times) or "try 50 tinned fish". ADR 0002 says Challenge criteria use the one expression model, but that model judges one record at a time. It has no way to count or group. So a Challenge splits into two parts:

- **The match** is an expression tree in the logic context, evaluated once per Session: *does this Session count?* It reuses slice 2's condition and filter nodes, plus a few references only criteria can use (the Session's effective Tags, a Participant, the Session Verdict, "I won").
- **The measure** is chosen from a fixed list and counts the matching Sessions in the window: *Sessions*, *distinct Items*, *first-time Items*, or *Items with at least k Sessions*. A target then turns that count into progress.

Criteria evaluate with **three-valued logic**. An opinion or result the criteria read (a Verdict, a Rating field, a Score result) that is missing or incomplete gives *unknown*, not false. Such a Session is shown as *pending* and never counts, so progress is never inflated or quietly short (NFR-10). Missing Attributes, Tags and Status are facts, not unfinished input, so they stay false as in slice 2.

## Considered Options

- **Aggregation nodes in the tree** (count, distinct, group-by, with a third "aggregate" evaluation context). We rejected it for v1. Every Challenge, even "log 20 Sessions", would need the web node editor. Two kinds of node (per-record and per-set) would sit in one tree, and validation and evaluation would get much more complex for a handful of shapes that a short list covers.
- **Slice 2's two-valued rule** (absent means no match). We rejected it because a Session with no Verdict yet would silently miss "rated 4★ or more", and the user would see a total that looks final but isn't.
- **Keeping the decision in the spec only.** We rejected it because the stored shape of a Challenge (a match tree, a measure kind and a target) is hard to change once people have Challenges running, and it narrows what ADR 0002 promised.

## Consequences

- A new kind of Challenge is a new measure kind, added in code with its own tests. That's the same way a new capability is a new node type in ADR 0002.
- Criteria get their own validation profile, beside the condition and filter profiles. References that read one Level's fields are only allowed when the Challenge's scope is a single Collection and Level.
- Progress is always derived from Sessions on read and never stored. Editing a Session, its date or the criteria changes progress, and Sessions logged before the Challenge was created count.
- Items count only through Sessions. An Item that has an Overall Rating but no Session has no date, so it can't fall inside a window.
- Club and Community Challenges (Social) can reuse the match and measure unchanged over a Club's Collections. Templates that ship Challenges must remap the ids in the match tree.
