# Haggs workflow discovery

Incremental change after `d4d8c0e` on `codex/playable-game-director-atlas`. Only the Workflows gallery and this handoff document change; the landing page is untouched. Keep merge/deployment hold.

Previously, custom workflows were spread through Quick start / Featured below the four LTX adaptations. Workflows now has a visible Haggs tab, a top-level “Haggs custom workflows (16)” link, and a direct `/workflows#haggs` URL. Group anchors expose seven effects, six Game Director tools and three world/motion/VFX toolsets. Search filters the custom catalog while Haggs is selected. All original app links, downloads, sample media, Playable links and existing sections remain.

Membership follows included Haggs custom-node source and MIT attribution in Contest Lab, Game Director and HaggsStudio. This verifies the package attribution, not contributor identity. The four Comfy-Org/Lightricks adaptations remain in Featured with an “upstream adaptations” heading, outside Haggs. The provenance link and upstream credits remain visible; imported models are not labeled as Haggs-built.

Browser verification (local webpack development preview): direct hash link selected Haggs after hydration; 16 custom badges visible; atlas search found Moveset Builder and Enemy Intent Painter; unmatched search produced a clear empty state; upstream LTX section absent in Haggs and present again in Featured; selecting Haggs from Favorites cleared that filter. TypeScript check and focused catalog tests also passed. Existing full production build/test evidence at `d4d8c0e` is unchanged; no new GPU inference was attempted.

Release integration: apply this small delta after `d4d8c0e`; preserve the combined branch's independent gallery/Open Weights edits. No files in the combined checkout were modified.
