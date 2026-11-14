# Studio flow refinement — November 14, 2026

The existing creation/editing journey needed clearer entry points. Returning work sat below the start form; Shorts and Comics were absent from primary navigation; the editor redirected to the last cut without offering a choice; and tool visitation looked like production completion.

## Changes

1. **Projects:** a quick-resume card appears above the creation form when local projects exist. It uses real project timestamps and attached-media progress, with an anchor to choose another project. Empty accounts still see the original creation flow.
2. **Create:** one disclosure exposes Photos, Video, Shorts Studio, Comic Studio, Shot Coverage and existing Production Tools. Photos/Video move into this group. The menu uses a body portal so mobile bottom navigation cannot clip it. It supports outside click, Escape with restored focus, reverse Tab from the first link and normal link navigation. Resizing dismisses an open menu.
3. **Editor home:** removes the automatic redirect. Shows an explicit last-board resume, actual selected-media preview, duration, video/still counts, searchable board cards, useful no-results recovery and an actionable first-project state. Missing remembered boards fall back to current project data. Existing media previews explain unavailable files.
4. **Cut:** the main navigation correctly selects Editor. Existing stale prompts appear as an optional review link instead of a prominent instruction to remake footage; missing-media/animation guidance remains distinct. Prepare/Shape/Finish are clickable tool categories, with no checkmarks pretending that opening tools completes the film.
5. **Small screens and access:** menu placement verified at 390×844, control focus checked, stage controls have 44px minimum height, and the resume/board layout wraps. Reduced-motion preference disables the rotating-tip animation. Existing file-preview instructions now match explicit account enrollment.

No new routes, dependencies, models, provider calls, account configuration, subscriptions or production promotion are included. Existing generation/export behavior and private-restore safeguards stay in place.

## Evidence

Captured the current candidate before edits, then compared saved before/after screenshots at matching 1440×1000 and 390×844 viewports. The fixture is explicitly labelled “Refinement review” and contains three existing sample stills; it is not a newly rendered film. Only the separate test browser was used.

Local receipts (ignored output): `output/refinement/REVIEW.md`, numbered screenshots, `check-refinement.js` and `check-production.js`.

- Projects → quick resume checked against the imported project.
- Editor → search/no results/clear, opening the last cut, and returning to the chooser without redirect checked.
- Create → Shorts link checked in the dev candidate; Comic link, Escape/reverse-Tab focus and a fresh empty account checked in the production build.
- Cut → Finish opens Voice; optional stale-prompt link is displayed; no generation controls invoked.
- Mobile → navigation menu stays in the viewport and is not clipped by the bottom bar; editor home and cut do not overflow horizontally.
- Production-build phone check reported zero page errors. Dev-only Next indicator was hidden in one dev capture because it overlapped the bottom bar; the production-build repeat needed no such workaround.
- Full Node suite: 1,535 passed, 8 skipped, 0 failed. Typecheck and production build passed. A first run exposed a shared-nav CSS module import reaching Node frame tests; moving the navigation styles to the existing global stylesheet resolved that error without mocking CSS imports or dropping tests.

These checks do not establish full accessibility compliance, authenticate a hosted owner session, verify private cloud restoration or qualify a paid GPU workflow. R1–R6 remain governed by `docs/release/READINESS.md`.
