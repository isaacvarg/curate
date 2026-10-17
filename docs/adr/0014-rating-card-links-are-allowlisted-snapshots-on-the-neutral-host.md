# Rating Card links are allowlisted snapshots on the neutral host

A Rating Card's public link gets posted to social apps and group chats, where it can't be recalled or edited. So publishing a Rating Card stores a **snapshot**, and the link shows that snapshot:

- **Only what's on the card.** The snapshot holds the values already formatted for display:
  - the Item name (and its parent's, if the user chose it);
  - the Verdict as displayed ("9/10", "★★★★½", "A tier");
  - the chosen fields' names and displayed values, each with a Shared Field badge flag;
  - for a Session card, its date and the user's Total and placement;
  - the user's note, and their name only if they chose to show it;
  - the design, and copies of the chosen photos and the rendered images.
  
  It holds no ids, Tags, locations, Guest or member names, or other Participants. The public page renders only the snapshot and never reads live data.
- **Frozen until updated.** Changing a rating doesn't change a published card. *Update* replaces the snapshot under the same code. *Revoke* deletes the snapshot and its files, and the code then answers "no longer shared". It's never reissued.
- **On the neutral host.** The link is `https://<label host>/r/<code>`. It uses the product-neutral host and its legacy-host list from [ADR 0009](0009-labels-encode-an-opaque-code-on-a-neutral-domain.md), so a product or domain rename never breaks a posted link (NFR-7).
  - The code is 10 characters of Crockford base32 from its own code space, and resolving it accepts any case.
  - The path doesn't clash with Label codes, which are a single path segment.
- The page tells search engines not to index it, has no third-party scripts and is cached briefly, so an Update or Revoke shows up within minutes.

## Considered Options

- **A live view** (the link reads the current rating and chosen fields). We rejected it. An old post would silently change meaning, and the public page would read live personal data on every view. Then one projection bug could leak something the user never chose to share.
- **A filtered member view** (render the member's Item page with fields hidden). We rejected it for the same reason as slice 7's Label page: public surfaces are explicit allowlists, never subtractions from a private view.
- **The app's main domain.** We rejected it because the product name is a placeholder. Every posted link would depend on the old domain staying alive as a redirect.
- **A third, separate share domain.** We rejected it. It would be one more domain to register and keep for the life of the product, when the Label host already has to be neutral and permanent.
- **Slugs with the Item name** (`/r/wingspan-9-10`). We rejected them because they reveal the content in the URL and break when it's updated.

## Consequences

- The Label host becomes the product's **neutral public host**, serving Labels at `/<code>` and Rating Cards at `/r/<code>`. Its length is still capped by the Label QR fit (ADR 0009).
- Rating Card links aren't universal links. They always open the web page, because most people opening them don't have the app.
- Deleting a photo used by a published card removes it from that card's snapshot. Privacy wins over the snapshot staying identical. Deleting an Item or Collection revokes its cards.
- A snapshot is the user's data, so Rating Cards join the export as an additive minor version of its format ([ADR 0013](0013-exports-are-a-versioned-json-document-with-derived-csv-views.md)).
- Cards for lists ("my top 10 games of 2027") can reuse the same snapshot and link model later.
