# Review preservation fixes

The three findings from PR #91 review 5732731306 reproduce on main efc9979 plus the material-preview fix: image replacement retained a box marker, generated-video duration was discarded, and prop motion beyond the camera path was truncated. The initial local regression run failed all three cases before these changes.

- Image replacement clears the procedural marker in the shared prop updater, covering library selection, reference selection and drag/drop. Placement, animation, materials and saved assets remain intact; explicit primitive duplication retains its marker.
- Both Grey Room entry points carry the generated duration into the new take and shot. Take switching remembers each edited duration (including legacy null/default durations) alongside trim and scene state. Invalid durations are ignored. Existing takes without duration metadata retain their previous behavior.
- Control-video fitting derives its interval from visible prop keys and camera keys, then scales both by the same factor. Relative timing and final poses survive short cameras and longer props. The reported encoded duration includes the final frame, verified using local FFprobe.

Focused tests cover the three reproductions, ordinary image export and Blender manifests, drag replacement, take switching and JSON round trips, timeline offsets, invalid duration inputs, relative animation timing, and encoded duration. TypeScript passed. Full suite, production build and desktop/mobile release checks are recorded separately in the local release evidence.

Paid Grey generation remains default-off. No paid model call, credential change or remote migration is required or performed. Actual provider output fidelity and billing still require separately approved live testing.
