# Exports are a versioned JSON document with derived CSV views

Users must be able to take everything they've created with them, in open formats, at any time (NFR-8, FR-10.2). Once people keep archives and write scripts against them, the export's shape is hard to change. So an **Export** has one canonical part and some convenience parts:

- **The JSON document** (`data.json`) is canonical. It holds every record in the export's scope, by id: configuration, Items, Sessions, Occasions, Challenges, Templates the user published, media metadata and the user's account settings.
  - Expression trees and Score Card documents are included as stored, with their own format versions.
  - Values are raw, on their own scale.
  - Derived data that's never authoritative (Score results) sits in a separate, clearly marked block.
- **CSV views** are derived from the same data for spreadsheets: one file per Collection Level in slice 11's path-column shape, so a view can be imported again, plus Session, Participant and Score files. They carry no stability promise beyond that round trip.
- **Media originals** are stored as files named by their parent and Media id, and the JSON references them by path.

**The stability promise** covers the JSON document only:

- It has a product-neutral **format name** (`collection-export`), never the product's name (NFR-7), and a **version** written `major.minor`.
- Within a major version, changes are additive only: new optional properties, new record kinds, and new enum values announced in a minor version. Readers must ignore what they don't know.
- Removing, renaming or retyping anything needs a new major version.
- Every version has a JSON Schema, generated from the shared package's schemas. It's included in every archive and published with the product docs.
- **Ids are stable.** A record has the same id in every export of the same data, so two exports can be compared.

## Considered Options

- **CSV only.** We rejected it. Expression trees, Score Card documents and nested Participant values don't fit flat tables, and an export that can't hold a Score Card isn't "everything".
- **Promising stability for the CSVs too.** We rejected it. CSV columns follow the user's own fields, so their shape changes whenever a field is added or renamed. Promising more than the import round trip would freeze the spreadsheet layout for no benefit.
- **Naming the format after the product.** We rejected it because the name is a placeholder (NFR-7). Archives written today must still read correctly after a rename.
- **An unversioned dump of the database tables.** We rejected it. It would leak storage details (Better Auth tables, Session revision snapshots, internal flags), and every schema migration would silently change the format.

## Consequences

- A change to the data model needs a matching change to the export projection and its schema. A test checks every export against the schema of its version.
- The JSON document is a stable target for a later "restore from export" or for other apps' importers. Neither is in v1.
- Session and Occasion revision snapshots, replacement notices and other server bookkeeping aren't part of the format. Only the latest state is exported.
