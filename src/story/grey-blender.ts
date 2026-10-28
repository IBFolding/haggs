import { atmosphere, type GreyScene, type Key } from "./grey-scene";
import { camAt, type CamKey } from "./grey-camera";
import type { GreyFrame } from "./grey";

/**
 * A Grey Room set as a Blender scene, for the shots that need real 3D light,
 * a better render or a finishing pass. The bundle is a folder: `scene.json`
 * (this manifest), `build_scene.py` (builds the set in Blender from it),
 * `assets/` (every picture and video the set uses) and a README. Run the
 * script in Blender, render, and bring the mp4 back into the Grey Room as a
 * new take. Nothing here needs a server beyond zipping the files.
 */

export type BlenderManifest = {
  version: 1;
  name: string;
  width: number;
  height: number;
  fps: number;
  frames: number;
  exposure: number;
  actor?: { file: string; kind: "movie" | "image" };
  backdrop?: { file: string; scale: number; x: number; y: number; keys?: Key[] };
  /** The grey room camera. When present the set gets a perspective camera that makes this move. Metres and degrees, as in the Grey room. */
  camera?: { angle: number; distance: number; height: number; lens: number };
  /** The camera's keys at the shot's frame rate. */
  cameraKeys?: { frame: number; angle: number; distance: number; height: number; lens: number }[];
  /** Stand-in figures from the Grey room's room plan, metres from the middle. */
  figures?: { label: string; x: number; z: number }[];
  props: { name: string; file: string; x: number; y: number; w: number; rotate: number; opacity: number; behind: boolean; flip: boolean; /** A 3D model file; the script imports it instead of making a flat picture. */ model?: string; keys?: Key[] }[];
  lights: { kind: string; x: number; y: number; size: number; color: string; intensity: number; spot?: boolean; power?: number; keys?: Key[] }[];
  /** relative file name → where this app reads it from, so the bundle can copy it in. */
  assets: Record<string, string>;
  notes: string[];
};

const slug = (url: string) => (url.split("/").at(-1) ?? "file").split("?")[0]!.replace(/[^\w.-]+/g, "-").slice(-60);

export function blenderManifest(scene: GreyScene, o: { name: string; size: { w: number; h: number }; seconds: number; fps: number; footage: { url: string; kind: "video" | "image" }; grey?: GreyFrame }): BlenderManifest {
  const assets: Record<string, string> = {};
  const byUrl = new Map<string, string>();
  const add = (url: string) => {
    const have = byUrl.get(url);
    if (have) return have;
    const file = `assets/${byUrl.size + 1}-${slug(url)}`;
    byUrl.set(url, file);
    assets[file] = url;
    return file;
  };
  const notes: string[] = ["Lights here are real Blender lights, so they light the props; the actor and the background are shown as they are, unlit."];
  if (atmosphere(scene).length) notes.push("Fog, rain, snow and the other air aren't in the Blender set. Add them in Blender or leave them to the Grey Room draft.");
  if ((scene.surfaces ?? []).some((s) => s.mask && s.texture)) notes.push("New wall and floor materials aren't in the Blender set.");
  if (scene.look && (scene.look.contrast || scene.look.saturation || scene.look.warmth || scene.look.vignette)) notes.push("Only the brightness of the look carries over; colour and contrast are best finished after rendering.");
  const actorUrl = scene.matte?.url ?? o.footage.url;
  const actorKind = scene.matte ? "movie" : o.footage.kind === "video" ? "movie" : "image";
  if (!scene.matte) notes.push("The actor isn't cut out yet, so the original footage fills the frame.");
  const grey = o.grey;
  const keys: CamKey[] = grey?.camKeys ?? [];
  if (grey) notes.push(keys.length > 1 ? "The Grey Room camera move is a perspective camera in the set. The actor and the pictures are flat, so they show parallax rather than turning." : "The Grey Room camera is a perspective camera at its still position.");
  return {
    version: 1,
    name: o.name,
    width: o.size.w,
    height: o.size.h,
    fps: o.fps,
    frames: Math.max(1, Math.round(o.seconds * o.fps)),
    exposure: scene.look?.exposure ?? 0,
    ...(grey ? {
      camera: { angle: grey.cam.angle, distance: grey.cam.distance, height: grey.cam.height, lens: grey.cam.lens },
      ...(keys.length > 1 ? { cameraKeys: keys.map((k) => ({ frame: 1 + Math.round(k.t * o.fps), angle: camAt(grey.cam, keys, k.t).angle, distance: k.distance, height: k.height, lens: k.lens })) } : {}),
      figures: grey.subjects.map((s) => ({ label: s.label, x: s.x, z: s.z })),
    } : {}),
    actor: { file: add(actorUrl), kind: actorKind },
    ...(scene.backdrop ? { backdrop: { file: add(scene.backdrop.url), scale: scene.backdrop.scale, x: scene.backdrop.x, y: scene.backdrop.y, ...(scene.backdrop.keys ? { keys: scene.backdrop.keys } : {}) } } : {}),
    props: (scene.props ?? []).filter((p) => !p.hidden).map((p) => ({ name: p.name, file: add(p.url), x: p.x, y: p.y, w: p.w, rotate: p.rotate, opacity: p.opacity, behind: p.behind, flip: p.flip === true, ...(p.model ? { model: add(p.model.url) } : {}), ...(p.keys ? { keys: p.keys } : {}) })),
    lights: (scene.lights ?? []).map((l) => ({ kind: l.kind, x: l.x, y: l.y, size: l.size, color: l.color, intensity: l.intensity, ...(l.spot ? { spot: true } : {}), ...(l.power !== undefined ? { power: l.power } : {}), ...(l.keys ? { keys: l.keys } : {}) })),
    assets,
    notes,
  };
}

export const BLENDER_README = (m: BlenderManifest) => `HAGGS GREY ROOM, ${m.name}
${"=".repeat(24 + m.name.length)}

This folder builds your set in Blender as a flat, layered scene seen by an
orthographic camera: the background, props behind the actor, the actor, props
in front, and real lights. Everything is set at the size and length of your shot
(${m.width} x ${m.height}, ${m.frames} frames at ${m.fps} fps).

${m.camera ? `The Grey Room camera is in this set as "GreyRoomCamera" (a perspective camera, ${m.camera.lens} mm to start)${m.cameraKeys ? `, with ${m.cameraKeys.length} keys that make the move you drew` : ""}. The flat orthographic camera "HaggsCamera" is still there: to use it, select it and press Ctrl+Numpad0.

` : ""}1. Open Blender (3.6 or newer) and a new General file.
2. Click the Scripting tab, then Open, and choose build_scene.py from this folder.
3. Click Run Script (the play button). The set appears.
4. Change anything you like: move a light, add a 3D object, change a material.
5. Choose Render > Render Animation (Ctrl+F12). The video is written to the render
   folder inside this one, as an mp4.
6. Back in the Grey Room, press "Bring in a Blender render" and choose that mp4.
   It comes in as a new take for you to look at before you keep it.

Or from a terminal, with no window:
   blender -b -P build_scene.py -a

Blender renders have no sound; the Grey Room puts your shot's original sound back.

Not included:
${m.notes.map((n) => `  - ${n}`).join("\n")}
`;

/** The Blender script. It reads scene.json next to it, so one script serves every shot. */
export const BLENDER_SCRIPT = String.raw`# Builds a Haggs Grey Room set in Blender from scene.json (same folder).
import bpy, json, math, os

def root():
    if "__file__" in globals():
        return os.path.dirname(os.path.abspath(__file__))
    try:
        return os.path.dirname(bpy.path.abspath(bpy.context.space_data.text.filepath))
    except Exception:
        return os.getcwd()

ROOT = root()
S = json.load(open(os.path.join(ROOT, "scene.json")))
W, H, FPS, FRAMES = S["width"], S["height"], S["fps"], S["frames"]
UW = 10.0                 # the frame is 10 Blender units wide
UH = UW * H / W
scene = bpy.context.scene

# Start clean.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()

scene.render.resolution_x = W
scene.render.resolution_y = H
scene.render.resolution_percentage = 100
scene.render.fps = FPS
scene.frame_start = 1
scene.frame_end = FRAMES
for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        pass
scene.view_settings.exposure = float(S.get("exposure", 0))
world = bpy.data.worlds.new("Haggs") if not scene.world else scene.world
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.02, 0.02, 0.025, 1)
    bg.inputs[1].default_value = 0.4

# A camera that looks straight at the frame. Depth is only for ordering.
cam_data = bpy.data.cameras.new("HaggsCamera")
cam_data.type = "ORTHO"
cam_data.ortho_scale = UW
cam_data.sensor_fit = "HORIZONTAL"
cam = bpy.data.objects.new("HaggsCamera", cam_data)
scene.collection.objects.link(cam)
cam.location = (0, -10, 0)
cam.rotation_euler = (math.radians(90), 0, 0)
scene.camera = cam

def frame_of(t):
    return 1 + int(round(t * FPS))

def load(rel, movie=False):
    img = bpy.data.images.load(os.path.join(ROOT, rel), check_existing=True)
    if movie:
        img.source = "MOVIE"
    return img

def material(name, img, movie=False, lit=True, opacity=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.extension = "CLIP"
    if movie:
        tex.image_user.frame_duration = FRAMES
        tex.image_user.use_auto_refresh = True
    if lit:
        shader = nt.nodes.new("ShaderNodeBsdfPrincipled")
        nt.links.new(tex.outputs["Color"], shader.inputs["Base Color"])
        nt.links.new(tex.outputs["Alpha"], shader.inputs["Alpha"])
        shader.inputs["Alpha"].default_value = 1.0
        # A little of the picture's own colour shows even in the dark, so a prop is never a black cut-out.
        try:
            nt.links.new(tex.outputs["Color"], shader.inputs["Emission Color"])
            shader.inputs["Emission Strength"].default_value = 0.35
        except Exception:
            pass
        nt.links.new(shader.outputs["BSDF"], out.inputs["Surface"])
        alpha_socket = None
    else:
        emit = nt.nodes.new("ShaderNodeEmission")
        clear = nt.nodes.new("ShaderNodeBsdfTransparent")
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(tex.outputs["Color"], emit.inputs["Color"])
        nt.links.new(tex.outputs["Alpha"], mix.inputs["Fac"])
        nt.links.new(clear.outputs["BSDF"], mix.inputs[1])
        nt.links.new(emit.outputs["Emission"], mix.inputs[2])
        nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    try:
        mat.surface_render_method = "DITHERED"
    except Exception:
        mat.blend_method = "HASHED"
    return mat

def plane(name, rel, width_units, y, movie=False, lit=True):
    img = load(rel, movie)
    iw, ih = img.size[0] or 1, img.size[1] or 1
    bpy.ops.mesh.primitive_plane_add(size=1)
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_euler = (math.radians(90), 0, 0)
    obj.scale = (width_units, width_units * ih / iw, 1)
    obj.location = (0, y, 0)
    obj.data.materials.append(material(name, img, movie, lit))
    return obj

def put(obj, x, yfrac, w_units, deg, flip):
    obj.location.x = (x - 0.5) * UW
    obj.location.z = (0.5 - yfrac) * UH
    aspect = obj.scale.y / max(obj.scale.x, 1e-6)
    obj.scale = (w_units * (-1 if flip else 1), w_units * aspect, 1)
    obj.rotation_euler = (math.radians(90), math.radians(-deg), 0)

def model_prop(name, rel, w_units, x, yfrac, depth, deg):
    """A 3D model in place of a flat picture. Returns an empty that holds it, or None if it can't be imported."""
    path = os.path.join(ROOT, rel)
    ext = rel.lower().rsplit(".", 1)[-1]
    before = set(bpy.data.objects)
    try:
        if ext in ("glb", "gltf"):
            bpy.ops.import_scene.gltf(filepath=path)
        elif ext == "obj":
            try:
                bpy.ops.wm.obj_import(filepath=path)
            except AttributeError:
                bpy.ops.import_scene.obj(filepath=path)
        elif ext == "fbx":
            bpy.ops.import_scene.fbx(filepath=path)
        else:
            return None
    except Exception as err:
        print("Could not import", rel, "-", err)
        return None
    fresh = [o for o in bpy.data.objects if o not in before]
    if not fresh:
        return None
    holder = bpy.data.objects.new(name, None)
    scene.collection.objects.link(holder)
    for o in fresh:
        if o.parent is None:
            o.parent = holder
    holder.scale = (w_units, w_units, w_units)
    holder.rotation_euler = (0, 0, math.radians(-deg))
    holder.location = ((x - 0.5) * UW, depth, (0.5 - yfrac) * UH)
    return holder

# Background: a picture sized like the preview (a width of 'scale' frames).
if "backdrop" in S:
    b = S["backdrop"]
    o = plane("Background", b["file"], UW * b["scale"], 6.0, lit=False)
    o.location.x = (0.5 - b["x"]) * (UW * b["scale"] - UW) * 1.0
    o.location.z = (b["y"] - 0.5) * (o.scale.y - UH)
    for k in b.get("keys", []):
        f = frame_of(k["t"])
        if "x" in k:
            o.location.x = (0.5 - k["x"]) * (UW * b["scale"] - UW)
            o.keyframe_insert("location", index=0, frame=f)
        if "y" in k:
            o.location.z = (k["y"] - 0.5) * (o.scale.y - UH)
            o.keyframe_insert("location", index=2, frame=f)

# The actor, as the cut-out video (or the original footage).
actor = S["actor"]
plane("Actor", actor["file"], UW, 0.0, movie=(actor["kind"] == "movie"), lit=False)

# Props: flat pictures, behind the actor or in front of them.
for i, p in enumerate(S["props"]):
    depth = 2.0 + i * 0.01 if p["behind"] else -2.0 - i * 0.01
    o = None
    if p.get("model"):
        o = model_prop(p["name"] or ("Prop %d" % (i + 1)), p["model"], UW * p["w"], p["x"], p["y"], depth, p["rotate"])
    is_model = o is not None
    if not is_model:
        o = plane(p["name"] or ("Prop %d" % (i + 1)), p["file"], UW * p["w"], depth, lit=True)
        put(o, p["x"], p["y"], UW * p["w"], p["rotate"], p["flip"])
    for k in p.get("keys", []):
        f = frame_of(k["t"])
        if "x" in k:
            o.location.x = (k["x"] - 0.5) * UW
            o.keyframe_insert("location", index=0, frame=f)
        if "y" in k:
            o.location.z = (0.5 - k["y"]) * UH
            o.keyframe_insert("location", index=2, frame=f)
        if "w" in k:
            if is_model:
                o.scale = (UW * k["w"],) * 3
            else:
                aspect = o.scale.y / max(abs(o.scale.x), 1e-6)
                o.scale = (UW * k["w"] * (-1 if p["flip"] else 1), UW * k["w"] * aspect, 1)
            o.keyframe_insert("scale", frame=f)
        if "rotate" in k:
            o.rotation_euler = (0, 0, math.radians(-k["rotate"])) if is_model else (math.radians(90), math.radians(-k["rotate"]), 0)
            o.keyframe_insert("rotation_euler", frame=f)

# Lights: real lights in front of the picture, so they light the props.
for i, l in enumerate(S["lights"]):
    data = bpy.data.lights.new("Light %d" % (i + 1), "SPOT" if l.get("spot") else "POINT")
    data.color = tuple(int(l["color"].lstrip("#")[j:j + 2], 16) / 255 for j in (0, 2, 4)) if l["color"].startswith("#") else (1, 1, 1)
    data.energy = l["power"] if "power" in l else 1500 * l["intensity"] * max(0.3, l["size"])
    data.shadow_soft_size = 0.5 + 2.0 * l["size"]
    o = bpy.data.objects.new("Light %d" % (i + 1), data)
    scene.collection.objects.link(o)
    o.location = ((l["x"] - 0.5) * UW, -3.0, (0.5 - l["y"]) * UH)
    if l.get("spot"):
        o.rotation_euler = (math.radians(90), 0, 0)   # aims into the picture
    for k in l.get("keys", []):
        f = frame_of(k["t"])
        if "x" in k:
            o.location.x = (k["x"] - 0.5) * UW
            o.keyframe_insert("location", index=0, frame=f)
        if "y" in k:
            o.location.z = (0.5 - k["y"]) * UH
            o.keyframe_insert("location", index=2, frame=f)
        if "intensity" in k and "power" not in l:
            data.energy = 1500 * k["intensity"] * max(0.3, l["size"])
            data.keyframe_insert("energy", frame=f)

# The Grey Room camera: a perspective camera at the angle, distance, height and lens
# you worked out, making the same move. It orbits the actor's picture, and looks at its
# middle. A Grey Room height is measured from the floor with the middle at chest height,
# so it is offset by 1.2 here. The actor and props are flat pictures: a move round them
# gives parallax, not a view of their other side.
if "camera" in S:
    gdata = bpy.data.cameras.new("GreyRoomCamera")
    gdata.sensor_fit = "HORIZONTAL"
    gdata.sensor_width = 36
    gcam = bpy.data.objects.new("GreyRoomCamera", gdata)
    scene.collection.objects.link(gcam)

    def aim(c):
        a = math.radians(c["angle"])
        gcam.location = (math.sin(a) * c["distance"], -math.cos(a) * c["distance"], c["height"] - 1.2)
        dx, dy, dz = -gcam.location.x, -gcam.location.y, -gcam.location.z
        yaw = math.atan2(dx, dy)
        pitch = math.atan2(dz, math.hypot(dx, dy))
        gcam.rotation_euler = (math.radians(90) + pitch, 0, -yaw)
        gdata.lens = c["lens"]

    aim(S["camera"])
    for k in S.get("cameraKeys", []):
        aim(k)
        gcam.keyframe_insert("location", frame=k["frame"])
        gcam.keyframe_insert("rotation_euler", frame=k["frame"])
        gdata.keyframe_insert("lens", frame=k["frame"])
    if S.get("cameraKeys"):
        aim(S["cameraKeys"][0])
    scene.camera = gcam

    # Stand-ins from the room plan, so the move has something to travel round.
    for fig in S.get("figures", []):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=1.75, location=(fig["x"], fig["z"], -1.2 + 0.875))
        bpy.context.active_object.name = "Figure " + fig["label"]

# Where the video goes.
out_dir = os.path.join(ROOT, "render")
os.makedirs(out_dir, exist_ok=True)
scene.render.filepath = os.path.join(out_dir, "haggs-")
settings = scene.render.image_settings
try:
    settings.file_format = "FFMPEG"
except TypeError:
    settings.media_type = "VIDEO"          # Blender 5 picks video first, then the format
    settings.file_format = "FFMPEG"
scene.render.ffmpeg.format = "MPEG4"
scene.render.ffmpeg.codec = "H264"
scene.render.ffmpeg.constant_rate_factor = "HIGH"
print("Haggs set ready. Render > Render Animation writes an mp4 to:", out_dir)
`;
