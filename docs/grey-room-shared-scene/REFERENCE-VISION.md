# Reference image proposal integration — disabled

The existing authenticated Claude writer transport can now carry explicitly selected reference previews as inline image blocks. This is an unenabled integration tested with synthetic images and mocked provider responses. It does not establish live model compatibility, image understanding quality or billing accuracy.

## Consent and data flow

1. Image selection is available only when the main proposal rollout, reviewed model/pricing settings and `HAGGS_GREY_AI_VISION_ENABLED=1` are all enabled. All flags remain unchanged and disabled during local application verification.
2. The user selects up to two saved references. The browser creates JPEG previews no larger than 768 pixels per edge; originals, source footage and project records remain untouched. Unsupported URLs, unreadable images and CORS failures are rejected without a proxy fallback.
3. Requesting a quote sends only bounded scene context and the selected preview bytes to Haggs. The server accepts only canonical base64 PNG/JPEG, at most 512 KiB each and two images. Sharp validates raster content and decoded pixel limits, resizes and re-encodes JPEG without EXIF/ICC metadata. It fetches no reference URLs and writes no files.
4. The quote stores hashes, not image bytes. Its context hash binds the selected image bytes and names; credentials, workspace, pricing and vision policy are also bound. The conservative estimate adds encoded-image byte counts and an allowance to the existing text/schema estimate. This is not an exact charge or spending cap.
5. The displayed quote shows the selected previews and image count. Explicit consent authorizes one provider request and sharing those previews. Changed references, selections or scene context invalidate the quote and consent. The frozen quoted input is reused; images are not silently reloaded before sending.
6. The shared atomic quote claim still precedes the provider call. An uncertain claim or repeated submission does not send again. The schema-validated proposal enters the existing review panel; it cannot edit the scene without Apply. A reply arriving after a scene change is discarded.

The transport reuses existing `keyIn`, workspace headers and `askClaude`; no new credentials, uploads to provider file storage, persistent image records, migrations or model calls were introduced. Text-only writer calls retain their original message body shape.

## Verification and remaining dependencies

Mock tests cover the default-off gates, actual disabled actions, invalid formats and URLs, byte/pixel/count limits, metadata removal, quote image allowance, changed-image/policy refusal, consent and one atomic send through the real writer adapter with fake fetch. Browser fixtures use the actual panel and image preparation code with mocked actions and block every HTTP request. Desktop/mobile checks cover selection limits, quote invalidation, frozen previews, explicit Apply, preservation and stale responses.

Required before rollout: operator-reviewed model vision support and pricing, the existing shared quote-store migration, an explicitly approved live-test budget, and real-provider fidelity/billing verification. None was performed or enabled here.

API contract checked against [Claude vision documentation](https://platform.claude.com/docs/en/build-with-claude/vision) and [Messages documentation](https://platform.claude.com/docs/en/build-with-claude/working-with-messages): image content blocks can carry inline base64 PNG/JPEG. Application limits above are intentionally tighter than provider limits.
