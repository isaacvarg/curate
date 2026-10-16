# Media is uploaded separately, straight to rustfs, and processed only on the phone

Media (photos, videos, voice memos) has to be captured offline at the table, and a video can be hundreds of megabytes, while Session and Occasion saves are whole-unit, idempotent upserts through the outbox (slices 3 and 5). So each Media item is its own record with a phone-generated id and its own outbox mutations (attach, upload bytes, complete), depending on its parent's save but never part of it. The bytes go from the phone straight to our private rustfs bucket through short-lived presigned URLs that the oRPC API issues and then verifies. All processing (resizing, removing metadata, thumbnails, video poster frames) happens on the phone, and the server does no processing.

## Considered Options

- **Media inside the whole save.** We rejected it because a resent or collapsed save would replace the media list and could delete photos, and the scores couldn't sync until every upload had finished.
- **Uploading through the API server.** We rejected it because it streams large files through Next.js for no benefit. Presigned URLs keep bucket credentials off the phone, and `media.complete` still lets the server confirm what was stored.
- **Server-side transcoding and thumbnails** (an ffmpeg/sharp worker). We rejected it for v1 because it adds a job queue and a worker to a stack that's otherwise Postgres, rustfs and Next.js (ADR 0001), and nothing could show until the server had processed it. Processing on the phone means thumbnails exist offline.

## Consequences

- A Session or Occasion save never reads, replaces or deletes Media. The one exception is that removing a Participant moves their Media to the Session.
- Media size per User (NFR-9) is a sum over Media rows that have finished uploading, so it can always be recomputed.
- Output quality and metadata removal depend on what each platform's picker and export allow. Removing location data from video has to be checked on iOS and Android before release.
- Server transcoding can be added later behind `media.complete` without changing the outbox.
