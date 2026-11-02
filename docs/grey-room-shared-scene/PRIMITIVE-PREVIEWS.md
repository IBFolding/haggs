# Material-aware primitive previews

The legacy compositor, scene inventory and placed-object shelf previously read a box stand-in's saved SVG URL, which retained its original gray appearance even after choosing wood, plaster or concrete. The shared 3D view, generation guide and server draft renderer already used the selected material.

These previews now derive an image from application-owned box geometry and the validated material palette. The server PNG renderer consumes the same SVG generator, so preview geometry and material color agree. Stored URLs and project data are not rewritten. Non-primitive image layers retain their exact URLs. Primitive URLs, names and arbitrary material markup are never embedded or fetched by the SVG helper.

Local verification: 23 focused tests pass, including material switching, saved-data preservation, arbitrary URL/material rejection and exact browser-SVG/server-PNG parity. TypeScript and `git diff --check` pass. Logs are in `output/material-preview-focused.log` and `output/material-preview-typecheck.log`.

This follow-up is based on released main 08a5f0f and remains local. Fresh full-suite, production build and desktop/mobile visual verification are still required before release. No paid generation, environment changes or migrations occurred. The imported-take fix on branch fix/grey-imported-take-preservation remains preserved separately.
