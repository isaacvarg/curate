# Account deletion is a scheduled leave from every shared Collection, then a purge

A User must be able to delete their account from inside the app (both app stores require it), and the deletion has to be real: their data gone, their public links dead and their email free to use again. But an account holds years of hobby data that can't be recovered, and some of it is woven into other people's history: a household's game nights, its Guests, its Labels. So deleting an account is two steps:

- **Request.** The User re-enters their password and is offered an Export first (slice 12). The account becomes *pending deletion* for **30 days**:
  - every sign-in session is revoked;
  - every public surface is hidden at once: Rating Card links answer "no longer shared", and the User's name comes off Label pages;
  - their open invites are revoked.
  
  Nothing else changes yet. Shared Collections, Sessions and Guests stay as they are, so cancelling restores the account exactly.
- **Cancel.** Signing in during the grace period shows only *Keep my account*, *Download my data* (their Exports) and *Sign out*. *Keep my account* makes the account active again and brings the public surfaces back.
- **Purge.** After 30 days, a background job:
  - runs **the original side of slice 10's leave plan** for every shared Collection that still has other members. If the User owns it, ownership first passes to the longest-standing remaining member. In the Sessions, the User becomes a Guest named after them, owned by the Collection owner, keeping their Scores. Their opinions, notes, Tags and Participant media are removed, and their Guests that appear there are copied to the owner. **No copy is made**, because nobody is left to own it;
  - deletes every Collection where they are the only member, as a Collection delete does (Labels become tombstones, Rating Cards are revoked);
  - deletes everything else that's theirs (Occasions, Challenges, Tags, Guests, Rating Cards, Exports, Media objects, notices) and their Better Auth rows;
  - keeps only a record with no personal data, which makes the job idempotent.

The email address becomes free when the purge finishes.

## Considered Options

- **Deleting immediately.** We rejected it. A mistaken tap, or someone who has the password, would destroy years of data with no way back. The grace period is disclosed on the deletion screen and in the confirmation email, which both stores allow.
- **Blocking deletion until the User has left every shared Collection by hand.** We rejected it. The leave plan already knows how to take a person out of a shared Collection without breaking anyone's history, so making the User do it Collection by Collection only adds steps.
- **Leaving the deleted User in shared Sessions as an anonymous "Former member".** We rejected it. The household already knew who played, and old score pads would become unreadable. The Guest is visible only to the Collection's members (FR-9.5), exactly as after a leave.
- **Running the full leave plan and keeping the copy for a possible return.** We rejected it. A deletion that keeps a copy isn't a deletion.
- **Better Auth's built-in user deletion.** We rejected it as the entry point, because it deletes at once and knows nothing of shared Collections. It stays disabled, and the purge job removes the Better Auth rows at the end.

## Consequences

- *Pending deletion* is an account state that every authenticated procedure checks. Only restoring the account, Exports and signing out are allowed in it.
- The leave plan becomes usable without its copy side. Leaving and deleting share one tested function, so a household loses nothing more on a deletion than on a leave.
- Session-level Media the User uploaded to shared Sessions stays with the Session, because it's a shared part (decision 8.2). It's re-attributed to the Collection owner, so storage stays accounted per User (NFR-9).
- Shared Sessions keep no history that still contains the deleted User's personal values. Their revision snapshots are pruned down to the latest one, and a phone with an older base merges as it would against a pruned base ([ADR 0012](0012-shared-saves-are-patched-from-a-base-revision.md)).
- Rating Card codes and Label codes stay tombstoned forever and are never reissued ([ADR 0009](0009-labels-encode-an-opaque-code-on-a-neutral-domain.md), [ADR 0014](0014-rating-card-links-are-allowlisted-snapshots-on-the-neutral-host.md)).
- Official Templates a curator published outlive their account, because adopters' update offers depend on them ([ADR 0011](0011-templates-are-published-snapshots-adopted-as-copies-with-origin-keys.md)). Only the link to the publisher is cleared.
