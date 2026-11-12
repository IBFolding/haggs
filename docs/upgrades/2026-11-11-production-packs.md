# Portable production packs and shot continuity

Implemented on top of the creator-studios candidate. No production deployment, model weights, upstream Python runtime, paid generation, provider configuration or billing change is included.

## Production handoff

Projects → Production pack downloads a flat, uncompressed `.production.zip` with:

- `project.haggs.json`: editable project, all boards, takes, cast, voice/effects/overlay configuration and optional script sheets.
- Actual stored raster images, audio and video files, deduplicated. Same-origin sample media is included too. Inaccessible supported stored media stops the export.
- `script.md` (including source screenplay when script sheets exist), `shots.csv`, `continuity.json`, `contact-sheet.html` and `README.txt`.
- `manifest.json`: per-file byte counts and SHA-256 digests, media mapping and unbundled dependencies.

The contact sheet loads only packaged stills/reference frames. It does not fetch remote thumbnails or imply that a selected video has a generated thumbnail. HTML is escaped and has a restrictive content policy; spreadsheet formula-leading text is escaped in CSV.

Import the ZIP through the existing project importer. The reader only accepts this stored ZIP dialect, with flat names, unique entries, bounded file sizes, a matching central directory, complete manifest, file digests, known media types and valid attachment references before any upload. Unsupported/compressed ZIPs must not be treated as generic archives. Integrity hashes detect damaged files; they do not authenticate who made a pack.

Restoration always creates a fresh project ID; production packs never replace an existing source through importKey. Storage uploads remain an explicit action and may consume quota. If an upload fails, the project is not saved; files already uploaded can remain in Account Files. Account-backed transactional storage and cross-device access are separate R1/R3 gates.

Limits: 30 MB per file, 128 MB payload, 200 total entries (193 media attachments with the standard documents). External and unsupported local URLs remain listed dependencies, rather than being silently fetched with owner credentials. Known key/connection/job fields are removed recursively, including serialized JSON objects. Free-form notes/prompts remain authored content; this is not a general-purpose secret detector. There are no API credentials or model weights in the application export contract.

## One compilation path

`src/story/compile.ts` is shared by `shoot()` and the new board/editor continuity brief. It derives the prompt, coerced settings and duration, ordered images, starting/end frames, cast and warnings. Shot-chosen references retain priority; assigned character reference images follow, deduplicated and limited by the model. A cast-only image never becomes an implicit starting frame. Assigned character names also enter the shared prompt assembly, so they participate in existing prompt staleness detection.

The UI exposes exact application generation inputs, included/missing cast references, dropped references, settings and separate voice-line readiness. Voice lines are not falsely described as picture-prompt input. Existing stale starting-frame dependencies and unsupported starting-frame models still block generation. Missing optional references produce warnings. The compiler does not invent missing character descriptions or silently switch models. API/workflow adapters can still transform these application inputs into their own wire format.

The archived continuity document uses the pack's media IDs with the same media-to-file mapping, preserving portability. Unsupported saved models are reported per shot rather than preventing export of otherwise usable creative work.

## Verification

- Full Node suite: 1,526 passed, 8 skipped, 0 failed. Typecheck and production build passed. No provider requests are made by these checks.
- Browser: exported a real project containing two existing sample JPEGs; downloaded ZIP checked independently with Python zipfile CRC and SHA-256 checks. Both images were in the archive, with zero unbundled media dependencies for that fixture.
- Browser: displayed assigned cast and the actual compiled prompt in the board inspector.
- Browser: opened the extracted contact sheet offline; its packaged still loaded.
- Browser: imported the same link-only ZIP twice, verified distinct IDs, then reloaded and retained both copies.
- Actual downloaded media pack restored through an explicit fixture uploader contract: two real image files returned and attached correctly. This is not a signed-in hosted storage test.
- Unit checks cover truncation, duplicate entries, damaged attachments, inaccessible stored media, credential-field omission, sample-path traversal, cast limits, cast-only first-frame behavior and stale-frame blocking.

## Attribution and boundary

Inspired by Slate's production packaging and continuity compilation in Imagination Studio by Keys and Sam Wasserman / Wasserman Productions, pinned upstream commit `ef88a0747686212749768b72d6a796932e8e583d` (`app/slate_package.py`, `app/slate.py`). These are original TypeScript implementations over Haggs' existing project/media/generation contracts, not copies of the Python engines. Existing directly reused editorial JSON data retains Apache-2.0 licence/notices in `third_party/imagination-studio`. No model, demo asset, artwork or hardware-qualification claim is copied.
