# Labels encode an opaque code on a neutral, permanent Label domain

Labels are physical and expensive to replace, so their URLs must outlive Items being Sold, Collection Members leaving, and renames of the product or its domain (NFR-7). A Label is therefore its own record mapping a random code to one Item. The QR code encodes `https://<label host>/<code>`:

- **The code** is 10 characters of Crockford base32 (50 random bits). It's never reused, and any case or confusable character (I, L, O) is accepted when it's resolved.
- **The Label host** is a product-neutral domain kept for the life of the product, separate from the app's main domain.

The accepted hosts are configuration: a current host plus legacy hosts. That list is the redirect layer, so a later domain move is a configuration change. Deleting an Item leaves a tombstone, so its code keeps resolving to a "no longer here" page and is never issued again.

## Considered Options

- **Encoding the Item id in the URL.** We rejected it because it leaks database ids and makes a denser QR code. It also ties the sticker to one database row forever, so a Label could never be re-pointed or transferred to a new owner (Social).
- **An opaque code on the app's main domain.** We rejected it because the product name is still a placeholder. A rename would leave every printed Label depending on an old domain kept alive only as a redirect.
- **Human-readable slugs** (for example `/wingspan-2`). We rejected them because renaming the Item would make the sticker misleading, and slugs reveal the Item to anyone who sees the URL.

## Consequences

- The URL is written in uppercase so that it fits QR alphanumeric mode. At error-correction level Q it stays at QR version 3, which scans from a 15 mm sticker. That caps the Label host's length, and the shared package checks the fit.
- `label.resolve` is the first unauthenticated procedure. Its public view is an explicit allowlist of fields (Item name, Status, the owner's name only if they opt in).
- Label rows are never purged, and a household member leaving takes a copy without the Labels (FR-9.2).
- Registering the Label domain, and keeping it registered, is an operational commitment from v1 onward.
