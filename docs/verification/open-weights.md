# Open Weights implementation and verification

Isolated branch: `codex/open-weights-paths`, based on combined integration commit `935b5be`. Uncommitted changes in the integration checkout were not copied or modified. No merge or deployment was performed.

## Changes

- Photos and Video expose explicit open-model workflow choices: Z-Image Turbo text-to-image, Qwen relighting, Wan 2.1 text-to-video, and Wan person swap. They open the existing editable workflow runner with actual public Comfy template IDs.
- Genjutsu offers a visible Wan person-swap alternative; selecting it is a separate user action.
- Workflow forms offer Your GPU / Comfy Cloud selection, including in disconnected/error states. Explicit destinations cannot silently fall back.
- Local template loading no longer requires a cloud key. ComfyUI must be reachable from the Haggs server, not merely running on the browser's computer.
- Read-only preflight fetches the selected live node catalog, checks conversion and exact model inventory, checks partner restrictions, and reads local GPU device/free-memory status. Missing requirements have actionable failures. The server repeats preflight before uploading media or submitting a generation.
- Automatic model-file substitutions block submission. A refreshed local inventory is checked again before execution.
- Local pricing says no provider charge, with hardware/electricity costs. Cloud open-model GPU prices and capacity are currently unknown: submission is blocked with instructions to use Your GPU or review/run in Comfy Cloud. This does not establish full cloud availability.
- Header help and marketing text no longer claim that Open Weights automatically runs locally or disables Photos/Video outright.

## Evidence

- Full existing test suite plus initial new tests: 1,005 passed, zero failed.
- Additional explicit-destination regression test added afterward; final targeted preflight/runtime suite: 10 passed, zero failed.
- Actual public template graphs downloaded from `https://cloud.comfy.org/templates/image_z_image_turbo.json` and `https://cloud.comfy.org/templates/text_to_video_wan.json`. Fixture tests establish rejection against incomplete inventories, not successful GPU generation.
- Browser checked at `http://127.0.0.1:3125`: switching Open Weights on shows Photos choices; Z-Image opens location/connection controls without Generate when disconnected; Comfy Cloud selection is explicit; Video shows both Wan choices.
- Read-only local check: `http://127.0.0.1:8188/system_stats` refused the connection. No live Comfy model render was attempted.
- `npm run typecheck`: passed. `npm run build -- --webpack`: passed (compilation, TypeScript, page generation and tracing). Default Turbopack cannot resolve the shared external node_modules symlink; webpack was used for this isolated checkout. Google Fonts retrieval required approved network access.

## Remaining work before release claims

1. Configure a reachable ComfyUI and install the exact required models/nodes under separate authorization, then run both photo and video workflows through result persistence and playback.
2. Integrate a reliable cloud GPU price/capacity check and enforceable spending bound before enabling these cloud runs. Current behavior deliberately blocks unknown cloud GPU costs.
3. Establish model-specific memory requirements: reported free VRAM alone cannot guarantee a workflow fits.
4. Exercise connected and failing inventories through the complete UI/server path. Existing recorded catalogs and transport mocks are not live availability evidence.
5. Review these changes with the combined release branch while preserving its unrelated uncommitted work. Keep the user's merge/deployment hold.

No credentials were copied, no software or model installation was performed, and no paid test job was submitted.
