# Comparison through a required Verdict, Shared Fields, and percentile

Users configure their own rating forms, so arbitrary fields can't be compared. Comparability comes from three tiers instead:

1. Every rating form has exactly one **Verdict** on a bounded, ordered scale. It's always present but pre-filled. It converts to 0–1, and cross-Collection rankings use percentile within the user's own Collection.
2. **Shared Fields** have a global identity and a locked scale, and for now only Official Templates define them. They are comparable between users.
3. Everything a user invents is personal and is never compared with other users.

## Considered Options

- **One universal scale.** Rejected, because it takes away freedom to rate however you like.
- **Matching fields by name** (treating everyone's "Peat" as the same). Rejected: names collide, scales differ, and results would be silently wrong.
- **Letting anyone's Template create Shared Fields.** Deferred, to avoid fifty different "Peat" fields at launch. Community Templates can use Shared Fields but not create them.

## Consequences

- Locking a Shared Field's scale is a promise: changing it means a new Shared Field, not an edit.
- Percentile rather than raw 0–1 drives rankings, so people who score in a narrow band (whisky between 82 and 94) are ranked fairly.
