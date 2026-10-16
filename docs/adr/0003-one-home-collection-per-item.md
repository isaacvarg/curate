# Every Item has exactly one home Collection; cross-Collection presence uses Linked Items

An Item belongs to exactly one Collection, and that Collection's Levels, Attributes and forms decide how it's described and rated. When the same real-world thing needs to appear in two places (a book club's pick and your own Books, a friend's Session on your board game), each place gets its own Item and the two are connected as **Linked Items**, with Verdicts visible across the link. Cross-cutting groupings within your own data use Tags.

## Considered Options

- **Items in many Collections.** Rejected. If one Item sat in "Books" and "Book Club Picks" with different forms, nothing could say which Attributes, conditions and Score Card apply.
- **Sub-collections.** Rejected. They bring back the same ambiguity. Structure inside a Collection is handled by declared Levels instead.

## Consequences

Verdicts are always comparable ([ADR 0004](0004-verdict-and-comparison-tiers.md)), so a Club can show members' opinions even when each member uses a different form.
