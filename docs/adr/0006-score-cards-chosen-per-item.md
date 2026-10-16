# Score Cards are chosen per Item, not configured per Level

A Score Card belongs to a Collection and is scoped to one Level, but each **Item** chooses which Score Card its Sessions use: the Level's default, none, or a specific card. One card can serve several Items (Wingspan and Wingspan Asia). Rating forms are configured per Level with conditional fields (decision 2.2), but Score Cards can't follow that model. Wingspan, Catan and golf all sit at the same "Game" Level and share no scoring rule, so a single card per Level would have to fake every game with conditions on a "which game is this" Attribute.

## Considered Options

- **One Score Card per Level, with conditional fields.** This mirrors rating forms. We rejected it because every game's categories, Rounds, win rule and tiebreakers would live in one card, gated by Attribute conditions. Win rules and Round structure can't be conditional field by field.
- **A Score Card owned by each Item.** We rejected this because sharing a card between Items (editions, reprints, "Simple points" for dozens of light games) would mean duplicating it and keeping the copies in sync by hand.
- **A Collection-wide library with no Level scope.** We rejected this because a card's conditions and child-Item references only make sense against one Level's Attributes and children.

## Consequences

- A Level's default card ("Points, highest wins") keeps Collections that don't care about per-game rules to one setting.
- Score fields are defined inside the card (in its revisions), not as Level fields, so the Level's Session form and the Item's Score Card are separate things.
- Templates (later) must bundle cards alongside Levels and remap Item and child-Item ids when they're copied.
