# Templates are published snapshots, adopted as copies with origin keys

A Template is published **from a Collection**. A shared snapshot function turns the source Collection's configuration (Levels, Verdicts, fields, Statuses, Score Cards, Item value source, Scan Action) into an immutable **Template version**. Every element in it is keyed by its id in the source Collection, so the next version, published from the same source, lines up with the last one element by element. Official Templates are published by curator accounts. Community Templates (Later) will use the same path.

**Adopting** a Template copies the elements with fresh ids and remaps every id inside every expression tree. Each copied element records its **origin**: the Template, its key, and the version it was last brought in line with. Nothing stays linked live (decision 7.8).

**Updates are offered one change at a time.** For each element, the version it came from (*base*), the latest version (*theirs*) and the Collection as it is now (*mine*) are compared property by property:

- A property only the Template changed is a clean change.
- A property both sides changed is a conflict, shown side by side, and keeping mine is the default.
- A change that existing data or a removed element rules out is blocked, with the reason.

Each offer is applied or dismissed on its own. A dismissed offer stays hidden until a later version changes that property again. When the Template retires an element, the Collection keeps it unless the user chooses to remove it.

**Shared Fields are minted only when an Official Template is published.** That creates a permanent registry row holding the field's locked properties (Field Kind, form, type, scale, shared choice options, and for a calculated Score field its expression). A copied field keeps its Shared Field identity only while those properties match. Editors refuse changes to them. The identity is dropped only by an explicit **Detach**, after which the field is personal.

## Considered Options

- **Official Templates as reviewed documents in the repo, synced on deploy.** We rejected it. Community Templates will be published by users from inside the app. Repo files would need a second path with its own storage, validation and diffing. Publishing from a Collection also lets curators build Score Cards in the node editor instead of writing expression JSON by hand.
- **Keeping Template ids in adopted Collections.** We rejected it. Two Collections adopted from one Template would share ids, and household copies (FR-9.2) would collide. Origin keys carry the link without making ids depend on it.
- **Whole-version updates** ("re-adopt v3") or a notice with a changelog only. We rejected them. A customized Collection either loses its changes or gets no help. Per-property offers keep every customization that the Template didn't touch.
- **Dropping Shared Field identity silently when a locked property is edited.** We rejected it. Comparability would vanish without the user knowing (NFR-10). Detach is a visible choice.

## Consequences

- Template versions and Shared Field rows are never edited or deleted, because adopters' offers are computed from them. A Template can be retired, which stops new adoptions and new offers.
- A new version may add, rename, reorder and retire elements, add choice options and publish new Score Card revisions. It may not retype an element, change its Field Kind or form, or move its Level. Publishing rejects those changes, and the curator retires the element and adds a new one instead.
- Deleting a source Collection freezes its Templates: they can still be adopted, but they get no new versions.
- Template Score Cards can't reference specific child Items, because Templates have no Items. That waits for Catalog Entries bundled with Templates (FR-1.10).
- The same copy function, given only some elements, adds one Shared Field or Score Card from a Template to any Collection, bringing along the fields it depends on.
