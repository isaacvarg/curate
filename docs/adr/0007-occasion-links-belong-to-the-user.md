# A Session's place in an Occasion belongs to the Occasion's User

An Occasion is personal (decision 7.2), but the Sessions inside it won't always be. Household Collections share Sessions between Collection Members (decision 8.2). In the social phase, a Session shows up in every User Participant's history (decision 11.3), and an attendee's Meetup Occasion holds Sessions someone else logged (decision 8.4). So the link between a Session and an Occasion is its own record, owned through the Occasion. Each User can put a Session in at most one of *their own* Occasions. It is not a single Occasion column on the Session. With one User per Session (v1 before households) this behaves exactly like "a Session belongs to at most one Occasion" (decision 5.3).

## Considered Options

- **An Occasion column on the Session.** This is the obvious shape, and it's what decision 5.3 reads like. We rejected it because the first shared Session breaks it. Both spouses at game night want the game in their own Occasion. Whoever groups it second would steal it from the other's journal, or would be blocked.
- **Shared Occasions** (one Occasion that every Participant or Collection Member co-owns). We rejected this because Occasions carry private notes, location and journal Visibility per User (decisions 6.4, 7.2). A co-owned diary entry would leak one person's write-up and whereabouts to the other.
- **Copying the Session into each User's data.** We rejected this because it duplicates Scores and shared notes, which then drift. It also contradicts the Session living in one place (decision 11.3).

## Consequences

- Saving a Session sets or clears only the *caller's* link. Another User's grouping of the same Session is never touched.
- Grouping is per User, so the timeline, "On this day", effective Tags and Community stats (decision 8.5) all ask "which Occasion is this Session in *for this User*?". There is no global answer.
- The household slice must still decide which shared Sessions appear in a member's timeline. The link shape won't need a migration whichever way that goes.
