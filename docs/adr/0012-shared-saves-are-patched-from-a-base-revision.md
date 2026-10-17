# Shared saves are patched from a base revision

In a household Collection, any Collection Member can edit a Session's shared parts (FR-3.7, decision 11.4), often offline and often from two phones at the same game night. Slice 3's whole-unit save with last-write-wins would let the later save silently erase the other member's edits. So a save is a **patch from a base**:

- `session.save` still sends the whole Session, by its phone-generated id, and stays idempotent. That keeps the outbox contract unchanged. The save also names the **base revision**: the revision the phone's edit started from.
- The server keeps an immutable **snapshot** of each revision. It works out what this phone changed (base → incoming), cell by cell, and applies only those cells on top of the current state.
- **Cells** are the smallest independent parts:
  - each header field (date, time, Session notes, Score Card revision, Round count);
  - each used Item;
  - each Participant (present or not, Team, *scoring*);
  - each Team;
  - each Score value (field, owner, Round);
  - each Participant value and Participant note.
- **Personal cells** (a User Participant's Ratings, Observations and notes) can only be written by that User. Two members therefore never collide on opinions.
- **Overlaps:** when both sides changed the same cell, the later save wins. The member whose value was replaced gets a **replacement notice** ("Your change to Sam's eggs was replaced by Ana's"). Nothing is lost silently (NFR-10).
- A cell that belongs to something the other side removed (values for a Participant who was taken out) is dropped, and the saver gets a notice.
- A save to a Session that another member deleted is rejected and goes to *needs attention*. The phone can discard it or save it again as a new Session.
- The Score result and calculated Verdicts are rebuilt from the merged state, as before.

Occasion saves use the same patch, because one User's two devices can race in the same way.

## Considered Options

- **Whole-unit last-write-wins** (slice 3). We rejected it because a second phone's save erases the first phone's Scores.
- **Rejecting stale saves** (optimistic concurrency). We rejected it because a game night logged on two phones would regularly land in *needs attention* and need entering again by hand.
- **The phone sends its base state with the save.** We rejected it. It doubles the payload, and it makes the server trust the client about history. Server-side snapshots cost little at personal data volumes.
- **Per-field clocks or CRDTs.** We rejected them as more machinery than one household's handful of concurrent saves needs. Session notes are a single text cell, not merged character by character.

## Consequences

- Revision snapshots are stored per Session and Occasion. Pruning them is allowed, but only for revisions older than any base a phone could still send (the outbox keeps its original base when it collapses repeated saves).
- The merge is a pure shared function over (base, current, incoming, author), so its rules are pinned by unit tests and the phone can preview them.
- FR-3.4 (one device enters every Participant's values) still holds for Guests and for every shared part. In a shared Collection, another User's Ratings and Observations are entered on their own phone.
