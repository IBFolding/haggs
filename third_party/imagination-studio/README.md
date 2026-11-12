# Reused Slate editorial data

Source: https://github.com/drowzeys/Imagination-Studio-by-keys-Wasserman
Pinned commit: ef88a0747686212749768b72d6a796932e8e583d
Retrieved: 2026-11-11
Licence: Apache-2.0 (included). Preserve both NOTICE and SLATE-NOTICE.

Unmodified source files copied into Haggs:
- app/static/slate/coverage-plans.json → src/creators/data/coverage-plans.json
- app/static/slate/setups.json → src/creators/data/setups.json

These files are editorial coverage recipes and prompt setup text. Haggs adds its own TypeScript adapters, controls and project creation around them. No upstream application code, model weights, installers, runtime engines, artwork, demos or machine-qualification results are included.

Credits: Keys (github.com/drowzeys) and Sam Wasserman / Wasserman Productions (wassermanproductions.com). Slate was created by Sam Wasserman (wassermanproductions.com).

The retained upstream NOTICE also describes the broader upstream product and model licences. Those model components are not bundled by this reuse; Apache licensing of the editorial data does not grant rights to separately distributed models or artwork.
