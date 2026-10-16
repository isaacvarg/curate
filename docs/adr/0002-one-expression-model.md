# One expression model for scores, Verdicts, conditions and Challenges

Score Card totals, calculated Verdicts, conditional fields and Challenge criteria all compute a value from fields. So they all share one expression model: a tree of inputs and operations (arithmetic, multipliers, min/max, powers, lookup tables) stored as data, never as code or formula strings. The evaluator lives in `packages/shared`, so it runs identically on the phone (including offline) and on the server. The node editor, and any simpler form view, are just editors over that tree. Editors can be added or replaced without migrating Templates or Collections.

## Consequences

- Templates carry expression trees, so sharing a Template shares its calculations exactly.
- Expressions can read every Participant's inputs in a Session, not just their own, so scoring that compares players (Longest Road, majority bonuses) is a node type, [rank among Participants]. Totals that depend on it stay incomplete until every input it needs is entered.
- New capabilities are new node types, not new subsystems.
