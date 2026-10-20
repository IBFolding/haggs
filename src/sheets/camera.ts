/**
 * Named camera moves for the shot sheet.
 *
 * Each one is written into the prompt as direction. The model decides the
 * motion; none of this is a native camera control, and nothing here promises
 * the move will land exactly as named.
 */

export const MOVE_GROUPS = [
  "Static",
  "Push & pull",
  "Slide & arc",
  "Rise & fall",
  "Zoom",
  "Handheld & body",
  "Speed & time",
  "Angle & lens",
  "Vehicle & flight",
] as const;

export type MoveGroup = (typeof MOVE_GROUPS)[number];

export type CameraMove = { id: string; label: string; group: MoveGroup; prompt: string };

export const cameraMoves: readonly CameraMove[] = [
  { id: "static", label: "Static", group: "Static", prompt: "Locked-off camera on a tripod. No camera movement; all motion comes from the subject and the environment." },
  { id: "general", label: "General", group: "Static", prompt: "Natural, unobtrusive camera behaviour chosen to suit the action. Keep framing stable and readable." },
  { id: "dolly-in", label: "Dolly In", group: "Push & pull", prompt: "Smooth dolly push in toward the subject at a steady, deliberate pace." },
  { id: "dolly-out", label: "Dolly Out", group: "Push & pull", prompt: "Smooth dolly pull back away from the subject, revealing more of the space around them." },
  { id: "super-dolly-in", label: "Super Dolly In", group: "Push & pull", prompt: "Long, fast, perfectly smooth dolly push from wide to close on the subject." },
  { id: "super-dolly-out", label: "Super Dolly Out", group: "Push & pull", prompt: "Long, fast, perfectly smooth dolly pull from close to a wide view of the scene." },
  { id: "double-dolly", label: "Double Dolly", group: "Push & pull", prompt: "The subject and the camera travel forward together, keeping the subject steady in frame while the background streams by." },
  { id: "eyes-in", label: "Eyes In", group: "Push & pull", prompt: "Slow push in that ends on an extreme close-up of the eyes." },
  { id: "mouth-in", label: "Mouth In", group: "Push & pull", prompt: "Slow push in that ends on an extreme close-up of the mouth as the subject speaks or breathes." },
  { id: "through-object-in", label: "Through Object In", group: "Push & pull", prompt: "The camera pushes forward through a foreground object or opening into the scene beyond it." },
  { id: "through-object-out", label: "Through Object Out", group: "Push & pull", prompt: "The camera pulls back through a foreground object or opening, leaving the scene behind it." },
  { id: "dolly-left", label: "Dolly Left", group: "Slide & arc", prompt: "Lateral dolly move sliding left, parallel to the subject." },
  { id: "dolly-right", label: "Dolly Right", group: "Slide & arc", prompt: "Lateral dolly move sliding right, parallel to the subject." },
  { id: "pan-left", label: "Pan Left", group: "Slide & arc", prompt: "Camera stays in place and pans smoothly to the left." },
  { id: "pan-right", label: "Pan Right", group: "Slide & arc", prompt: "Camera stays in place and pans smoothly to the right." },
  { id: "whip-pan", label: "Whip Pan", group: "Slide & arc", prompt: "A very fast whip pan with motion blur, snapping to the new subject." },
  { id: "arc-left", label: "Arc Left", group: "Slide & arc", prompt: "The camera arcs around the subject to the left, keeping them centred." },
  { id: "arc-right", label: "Arc Right", group: "Slide & arc", prompt: "The camera arcs around the subject to the right, keeping them centred." },
  { id: "orbit-360", label: "360 Orbit", group: "Slide & arc", prompt: "A full 360-degree orbit around the subject at a constant distance." },
  { id: "lazy-susan", label: "Lazy Susan", group: "Slide & arc", prompt: "Slow, continuous rotation around a tabletop or central subject, as if on a turntable." },
  { id: "rotation-3d", label: "3D Rotation", group: "Slide & arc", prompt: "The camera rotates around the subject on more than one axis, showing it from shifting angles." },
  { id: "crane-up", label: "Crane Up", group: "Rise & fall", prompt: "Smooth crane rise, lifting the camera up and away from the subject to reveal the setting." },
  { id: "crane-down", label: "Crane Down", group: "Rise & fall", prompt: "Smooth crane descent from high above, settling at the subject's level." },
  { id: "crane-over-head", label: "Crane Over The Head", group: "Rise & fall", prompt: "The camera cranes up and passes over the subject's head, looking down as it travels." },
  { id: "jib-up", label: "Jib Up", group: "Rise & fall", prompt: "A short, smooth jib rise from low to slightly above the subject." },
  { id: "jib-down", label: "Jib Down", group: "Rise & fall", prompt: "A short, smooth jib descent from slightly above to the subject's level." },
  { id: "tilt-up", label: "Tilt Up", group: "Rise & fall", prompt: "Camera stays in place and tilts up slowly, from the ground or the subject toward the sky." },
  { id: "tilt-down", label: "Tilt Down", group: "Rise & fall", prompt: "Camera stays in place and tilts down slowly, from the sky toward the subject." },
  { id: "aerial-pullback", label: "Aerial Pullback", group: "Rise & fall", prompt: "High aerial camera pulls back and rises, revealing the full scale of the landscape around the subject." },
  { id: "overhead", label: "Overhead", group: "Rise & fall", prompt: "Top-down overhead view looking straight down on the subject." },
  { id: "incline", label: "Incline", group: "Rise & fall", prompt: "The camera travels up a slope or incline toward the subject, rising as it moves." },
  { id: "zoom-in", label: "Zoom In", group: "Zoom", prompt: "Optical zoom in on the subject with the camera in place." },
  { id: "zoom-out", label: "Zoom Out", group: "Zoom", prompt: "Optical zoom out from the subject with the camera in place." },
  { id: "rapid-zoom-in", label: "Rapid Zoom In", group: "Zoom", prompt: "A quick zoom in that lands firmly on the subject." },
  { id: "rapid-zoom-out", label: "Rapid Zoom Out", group: "Zoom", prompt: "A quick zoom out that leaves the subject small in the frame." },
  { id: "crash-zoom-in", label: "Crash Zoom In", group: "Zoom", prompt: "A sudden, aggressive crash zoom in on the subject for impact." },
  { id: "crash-zoom-out", label: "Crash Zoom Out", group: "Zoom", prompt: "A sudden, aggressive crash zoom out away from the subject." },
  { id: "dolly-zoom-in", label: "Dolly Zoom In", group: "Zoom", prompt: "Vertigo effect: the camera dollies in while zooming out, so the background stretches behind a fixed subject." },
  { id: "dolly-zoom-out", label: "Dolly Zoom Out", group: "Zoom", prompt: "Vertigo effect: the camera dollies out while zooming in, so the background compresses behind a fixed subject." },
  { id: "yoyo-zoom", label: "YoYo Zoom", group: "Zoom", prompt: "Zoom in, then out, then in again in a rhythmic, playful bounce." },
  { id: "eating-zoom", label: "Eating Zoom", group: "Zoom", prompt: "Fast zoom toward the mouth as the subject takes a bite, then a quick settle." },
  { id: "handheld", label: "Handheld", group: "Handheld & body", prompt: "Handheld camera with natural, subtle shake and breathing movement, close to the action." },
  { id: "head-tracking", label: "Head Tracking", group: "Handheld & body", prompt: "The camera follows the subject's head closely as they move, keeping it in the same place in frame." },
  { id: "snorricam", label: "Snorricam", group: "Handheld & body", prompt: "Body-mounted rig: the subject stays fixed in frame, facing camera, while the world moves around them." },
  { id: "object-pov", label: "Object POV", group: "Handheld & body", prompt: "Point of view from an object in the scene looking at the subject." },
  { id: "wiggle", label: "Wiggle", group: "Handheld & body", prompt: "Small, quick back-and-forth camera wiggle for energy." },
  { id: "bts", label: "BTS", group: "Handheld & body", prompt: "Loose behind-the-scenes documentary camera, observing the moment rather than staging it." },
  { id: "hero-cam", label: "Hero Cam", group: "Handheld & body", prompt: "Low, slowly rising camera that makes the subject look heroic and larger than life." },
  { id: "glam", label: "Glam", group: "Handheld & body", prompt: "Slow, flattering camera drift with soft beauty lighting on the subject's face." },
  { id: "bullet-time", label: "Bullet Time", group: "Speed & time", prompt: "Time nearly freezes while the camera sweeps around the subject in a smooth arc." },
  { id: "low-shutter", label: "Low Shutter", group: "Speed & time", prompt: "Low shutter speed with streaking motion blur and light trails as things move." },
  { id: "hyperlapse", label: "Hyperlapse", group: "Speed & time", prompt: "Hyperlapse: the camera travels a long distance through the scene with time sped up." },
  { id: "timelapse-human", label: "Timelapse Human", group: "Speed & time", prompt: "Timelapse of people moving quickly around a still or slow subject." },
  { id: "timelapse-landscape", label: "Timelapse Landscape", group: "Speed & time", prompt: "Timelapse of a landscape with clouds, light and shadows moving quickly across it." },
  { id: "timelapse-glam", label: "Timelapse Glam", group: "Speed & time", prompt: "Timelapse of light changing across a posed, still subject." },
  { id: "focus-change", label: "Focus Change", group: "Angle & lens", prompt: "Rack focus that shifts from the foreground to the background, or back." },
  { id: "dutch-angle", label: "Dutch Angle", group: "Angle & lens", prompt: "Tilted Dutch angle for unease, with the horizon slanted across the frame." },
  { id: "fisheye", label: "Fisheye", group: "Angle & lens", prompt: "Ultra-wide fisheye lens with strong barrel distortion, close to the subject." },
  { id: "fpv-drone", label: "FPV Drone", group: "Vehicle & flight", prompt: "Fast FPV drone flight, swooping and banking through the space." },
  { id: "flying-cam-transition", label: "Flying Cam Transition", group: "Vehicle & flight", prompt: "The camera flies through the scene and carries into a new location in one continuous move." },
  { id: "car-chasing", label: "Car Chasing", group: "Vehicle & flight", prompt: "The camera chases a moving vehicle from behind at speed, low to the road." },
  { id: "car-grip", label: "Car Grip", group: "Vehicle & flight", prompt: "Camera rigged to the side of a moving car, looking at the driver or along the bodywork." },
  { id: "road-rush", label: "Road Rush", group: "Vehicle & flight", prompt: "Camera rushes forward low along a road, with the surface streaking beneath." },
  { id: "buckle-up", label: "Buckle Up", group: "Vehicle & flight", prompt: "Inside a vehicle: a close, jolting move as the subject braces for motion." },
  { id: "robo-arm", label: "Robo Arm", group: "Vehicle & flight", prompt: "Precise, fast robotic-arm camera move that sweeps and stops exactly on the subject." },
];

const byId = new Map(cameraMoves.map((move) => [move.id, move]));

export function cameraMove(id: string): CameraMove | undefined {
  return byId.get(id);
}

/** The line a move adds to a prompt, or nothing when no move is chosen. */
export function movePrompt(id: string): string {
  if (!id) return "";
  const move = byId.get(id);
  if (!move) throw new Error("Choose a camera move from the list.");
  return `Camera: ${move.prompt}`;
}
