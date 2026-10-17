# Curate

A personal app for collecting, rating and journaling anything: board games, beer, tinned fish, books. Solo use comes first, and social features build on top of it.

## Language

### Collecting

**Collection**:
A named grouping of Items of one kind, owned by a User, a household of Collection Members, or a Club, such as "Board Games" or "Beers I've Had". It sets how its Items are rated and described.
_Avoid_: Shelf, library, list

**Item**:
One thing a user has collected, belonging to exactly one Collection. It may be something they own, or something they've only experienced (a friend's copy, a beer they drank once).
_Avoid_: Entry, thing, product

**Linked Item**:
An Item in one Collection connected to an Item in another, such as a Club's pick and the member's own copy in their Books. Each keeps its own fields, and Verdicts are visible across the link.
_Avoid_: Shared item, duplicate, alias

**Level**:
A named tier in a Collection's declared structure, such as Show › Season › Episode or Game › Expansion. Every Item sits at one Level, and its parent Item is at the Level above.
_Avoid_: Sub-collection, depth, tier

**Attribute**:
A descriptive fact about an Item, such as ABV, brewery, player count, or fiction/non-fiction, configured per Collection Level. It describes the Item and expresses no opinion.
_Avoid_: Property, metadata, detail

**Label**:
A printable QR sticker or ex libris tied permanently to one Item through an opaque code on a neutral Label domain. Scanning it opens that Item or starts a Session for it, depending on the Collection's Scan Action.
_Avoid_: Tag, QR code, sticker

**Scan Action**:
What scanning one of a Collection's Labels does for a Collection Member: open the Item, or start a Session for it pre-filled with today, the Open Occasion and the usual Participants.
_Avoid_: Scan mode, scan setting

**Catalog Entry**:
A shared, canonical record of a real-world thing (e.g. "Wingspan") that many users' Items can optionally link to. Users keep control of their own Item regardless of the link.
_Avoid_: Master item, product page

**Status**:
A Collection-defined state of an Item, such as owned, played elsewhere, sold, or wishlist. Each Collection chooses its own options, or none at all.
_Avoid_: Ownership, condition

**Tag**:
A free-form label on an Item, Session or Occasion for ad-hoc grouping across Collections (e.g. "nature", "vacation"). Tags never drive which fields appear.
_Avoid_: Category, sub-collection

### Rating

**Overall Rating**:
A user's standing opinion of an Item, independent of any single Session, made up of a Verdict and any other Rating fields.
_Avoid_: Review, score

**Verdict**:
The one bottom-line Rating every Overall Rating and Session rating has, on a bounded ordered scale. It is the field compared across Collections and between users.
_Avoid_: Headline, bottom line, grade, overall score

**Session**:
A logged occurrence of experiencing one Item (a play, a tasting, a read), optionally with child Items used alongside it, such as an expansion. It may carry notes, media, Participants and their Ratings, Observations and Scores.
_Avoid_: Log, play, check-in, journal entry

**Occasion**:
A dated journal entry with its own notes, media and Participants. It may stand alone or contain the Sessions that happened during it, such as a brewery day or a game night.
_Avoid_: Event, outing, gathering, day

**Open Occasion**:
The one Occasion a User has started and not yet ended, which new Sessions join by default.
_Avoid_: Active Occasion, current Occasion, live Occasion

**Journal**:
The timeline of a User's own Occasions and Sessions, with their notes and media. It's a view, not something you create.
_Avoid_: Diary, feed, log

**Media**:
A photo, video or voice memo attached to an Occasion, a Session, or a Participant within a Session.
_Avoid_: Attachment, file, asset, upload

**Participant**:
A person present in a Session or Occasion, either a User or a Guest. In a Session, each Participant may record their own Ratings, Observations and Scores.
_Avoid_: Player, attendee

**Guest**:
A named Participant who isn't a User, owned by whoever created it. Its name is visible to its owner and to the Collection Members of Collections where it appears, and they can reuse it. A Guest can later be claimed by a real User.
_Avoid_: Anonymous player, friend

**Field Kind**:
What a configurable field records: an Attribute (describes the Item), a Rating (opinion), an Observation (what was perceived), or a Score (a game result).
_Avoid_: Field type

**Rating**:
An opinion field with an ordered scale, such as fun 4/5, Plot, or overall stars. It is given for an Item overall or per Participant in a Session.
_Avoid_: Score, grade

**Observation**:
A non-evaluative field recording what a Participant perceived, such as tasting notes, flavor descriptors, or complexity.
_Avoid_: Tasting rating, note

**Score**:
A field recording a game result for a Participant, either entered directly or calculated by a Score Card.
_Avoid_: Rating, points

**Score Card**:
The calculator that turns every Participant's Score fields in a Session into final results and a winner, like a board game's score pad. Each Item uses at most one, chosen from its Collection's Score Cards for that Level.
_Avoid_: Score sheet, rating form

**Round**:
One repeated pass of a Score Card's per-round fields, such as a golf hole, a Cribbage hand or a game round. Per-round values are summed.
_Avoid_: Turn, hand, frame

**Team**:
A set of Participants in a Session whose Scores are combined and who win or lose together.
_Avoid_: Side, faction

**Shared Field**:
A field definition with a common identity and a locked scale, minted when an Official Template is published. A copied field keeps the identity until the user explicitly detaches it, and values from different users for the same Shared Field are comparable.
_Avoid_: Standard field, global field

**Rating Card**:
A styled, shareable presentation of one rating (a User's Overall Rating of an Item, or their own values from one Session), where the user chooses which fields and photos to show. It's shared as an image, or as a public link to a frozen snapshot of exactly what the card shows.
_Avoid_: Share card, Score Card

**Challenge**:
A goal with criteria and a time window, measured against Sessions and Items (e.g. "10×10 in 2027", "try 50 tinned fish"). Its criteria pick which Sessions count, and a measure counts them toward a target.
_Avoid_: Quest, goal, achievement

**Template**:
A packaged setup for a kind of Collection (Levels, Attributes, Rating, Observation and Score fields, Score Cards, Statuses), published as versions from a source Collection and copied into a Collection when adopted. Later versions are offered change by change, never applied. Official Templates are published by curators, and community Templates come later.
_Avoid_: Preset, blueprint

**Export**:
A downloadable archive of a User's data, for their whole account or one Collection: a versioned JSON document that is the canonical record, CSV views derived from it, and media originals. In a shared Collection it holds the shared parts and only the exporting member's personal data.
_Avoid_: Backup, dump, download

### Social

**Visibility**:
Who can see something: Private, Followers or Public. It is set per Collection, and per user for Occasions and journal content.
_Avoid_: Privacy level, sharing

**Collection Member**:
A User who shares a Collection with others, such as a household, and can add Items and log Sessions in it. Each member keeps their own Overall Rating on shared Items, and a Session counts as theirs when they're a Participant in it.
_Avoid_: Co-owner, collaborator

**Follow**:
A one-way subscription to specific Collections of another User, opted into Collection by Collection. Following a User shows nothing until you choose what to follow.
_Avoid_: Friend, connection

**Community**:
A larger group, such as a game store or venue, with members, a feed and Meetups. It may host Clubs.
_Avoid_: Group, server, organization

**Club**:
A small group of Users with a shared focus, such as a book club or a co-op gamers club. It can stand alone or sit inside a Community, and may own Collections.
_Avoid_: Group, team, circle

**Meetup**:
A scheduled gathering hosted by a Community or Club. Attending creates the attendee's own Occasion linked to it, and that Occasion's Sessions count toward the host's stats.
_Avoid_: Event, meeting, session
