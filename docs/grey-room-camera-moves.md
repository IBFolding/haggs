# Grey Room camera moves

Named camera moves for the Grey Room: Arc, Push in, Pull out, Crane up, Crane down, Orbit, Bullet time, Dolly zoom and Whip. Each is a handful of plain numbers (how long, how far, which way, which side to start from) turned into ordinary camera keys by `src/story/grey-camera-moves.ts`. Because they are the same keys as any other path, key retiming, Reverse camera move, saving and reopening, shot snapshots and the Blender camera export all work unchanged.

Everything is arithmetic in the browser. No GPU, no provider call, no Comfy credits, and none of the Grey spending code is touched.

Limits worth knowing: the Grey Room camera always looks at the middle of the room, so "Start from the front of <figure>" picks the side the move starts from; it does not re-aim at that figure. Adding a move replaces the current camera path. Paths are at most 6 seconds and 12 keys.

## Credit

The idea of named, parameterised camera-move presets (arc, push, crane, orbit, bullet-time) was inspired by reshoot-4d (AGPL-3.0, open weights) by its creator, a tool for keyframed camera position, aim and roll with named presets. HAGGS reused no code from it; these presets are written from scratch for the Grey Room's existing four-number camera.

## Possible follow-up (not built)

[OpenField](https://github.com/wexloops/openfield) (MIT) has a browser 3D blocking "Stage" with boxes, figures, walls and user `.glb` models, a lens and camera path, and renders a grey clay clip plus a depth pass for the finished shot. The cheap, clearly useful idea for Grey Room is a depth-style pass exported alongside the grey render, so a Comfy depth-conditioned workflow could follow the blocking. Importing `.glb` props is the other candidate. Both need design work and are left for later.
