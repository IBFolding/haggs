#!/usr/bin/env python3
"""Haggs Worlds v1 -> editable Blender scene and optional Cycles frames.

Run with Blender 4.2+: blender -b -P scripts/worlds/render_blender.py -- --scene haggs-world.json --out ./out --preview
No network, cloud provider, or ComfyUI inference is invoked. A world JSON file is DATA, never Python code.
"""
import argparse
import json
import math
import sys
from pathlib import Path

try:
    import bpy
    from mathutils import Vector
except ImportError:
    raise SystemExit("Run this script with Blender's Python: blender -b -P scripts/worlds/render_blender.py -- --scene <file>")

ALLOWED_KINDS = {"island", "portal", "crystal", "monolith", "tower", "ground", "rock", "arch", "orb", "cube", "sphere"}
SHADER_CACHE = {}


def read_scene(path):
    if path.stat().st_size > 2_000_000:
        raise ValueError("World JSON exceeds 2 MB.")
    w = json.loads(path.read_text(encoding="utf-8"))
    if w.get("version") != 1 or w.get("preset") not in {"aether", "neon", "dunes"}:
        raise ValueError("Only Haggs Worlds version 1 is supported.")
    objects = w.get("objects")
    film = w.get("film") or {}
    shots = film.get("shots")
    if not isinstance(objects, list) or len(objects) > 600 or not isinstance(shots, list) or not 1 <= len(shots) <= 50:
        raise ValueError("Invalid objects/shots list.")
    fps, duration = film.get("fps"), film.get("duration")
    if not isinstance(fps, int) or not 1 <= fps <= 60 or not isinstance(duration, (int, float)) or not 0 < duration <= 120:
        raise ValueError("Invalid film frame rate or duration.")
    prev = 0
    for s in shots:
        if abs(s["start"] - prev) > 0.00001 or not s["end"] > s["start"] or not 12 <= s["lensMm"] <= 250:
            raise ValueError("Film shot time/lens invalid.")
        for key in ("from", "to", "lookFrom", "lookTo"):
            if not isinstance(s.get(key), list) or len(s[key]) != 3 or not all(isinstance(v, (float, int)) and math.isfinite(v) and abs(v) <= 500 for v in s[key]):
                raise ValueError("Camera position invalid.")
        prev = s["end"]
    if abs(prev - duration) > 0.00001:
        raise ValueError("Camera shots must cover film without gaps.")
    for o in objects:
        if o.get("kind") not in ALLOWED_KINDS:
            raise ValueError("Unsupported object kind.")
        if not all(isinstance(v, (float, int)) and math.isfinite(v) for v in o.get("position", [])) or len(o.get("position", [])) != 3:
            raise ValueError("Invalid object position.")
        if not isinstance(o.get("scale"), (float, int)) or not 0 < o["scale"] <= 100:
            raise ValueError("Invalid object scale.")
        rgb = o.get("color", "")
        if not isinstance(rgb, str) or len(rgb) != 7 or not rgb.startswith("#") or any(c not in "0123456789abcdefABCDEF" for c in rgb[1:]):
            raise ValueError("Invalid object color.")
    return w


def rgb(hex_string):
    return tuple(int(hex_string[i:i + 2], 16) / 255.0 for i in (1, 3, 5))


def material(hex_string, glow=0.0, metal=0.25, rough=.5):
    key = (hex_string, glow, metal, rough)
    if key in SHADER_CACHE:
        return SHADER_CACHE[key]
    m = bpy.data.materials.new("Haggs-" + hex_string[1:])
    m.diffuse_color = (*rgb(hex_string), 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*rgb(hex_string), 1)
        bsdf.inputs["Metallic"].default_value = metal
        bsdf.inputs["Roughness"].default_value = rough
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*rgb(hex_string), 1)
            bsdf.inputs["Emission Strength"].default_value = glow
    SHADER_CACHE[key] = m
    return m


def v(xyz):
    # Three.js is Y-up; Blender is Z-up. Coordinate basis keeps scene orientation consistent.
    return Vector((xyz[0], -xyz[2], xyz[1]))


def add(kind, name, parent, mat, pos=(0, 0, 0), dims=(1, 1, 1), rotate=None):
    if kind == "cylinder":
        bpy.ops.mesh.primitive_cylinder_add(vertices=11, radius=1, depth=1)
    elif kind == "cone":
        bpy.ops.mesh.primitive_cone_add(vertices=11, radius1=1, radius2=0, depth=1)
    elif kind == "torus":
        bpy.ops.mesh.primitive_torus_add(major_radius=1, minor_radius=.035, major_segments=72, minor_segments=10)
    elif kind == "ico":
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
    elif kind == "cube":
        bpy.ops.mesh.primitive_cube_add(size=1)
    else:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1)
    o = bpy.context.object
    o.name = name
    o.parent = parent
    o.location = v(pos)
    o.scale = Vector(dims)  # Blender local dimensions: X width, Y depth, Z height
    if rotate is not None:
        o.rotation_euler = rotate
    o.data.materials.append(mat)
    return o


def add_obj(spec):
    kind = spec["kind"]
    parent = bpy.data.objects.new(str(spec["id"])[:65], None)
    bpy.context.collection.objects.link(parent)
    parent.location = v(spec["position"])
    parent.rotation_euler = (spec.get("rotation") or [0, 0, 0])[0], -(spec.get("rotation") or [0, 0, 0])[2], (spec.get("rotation") or [0, 0, 0])[1]
    parent.scale = (spec["scale"],) * 3
    base = material(spec["color"], .04, .15, .68)
    rim = material("#d7cbb4", .03, .55, .28)
    emissive = material(spec["color"], 2.2, .25, .2)
    if kind == "island":
        add("cylinder", "Island crown", parent, base, (0, 0, 0), (1.2, 1.2, .32))
        spike = add("cone", "Island root", parent, material("#263c41"), (0, -.98, 0), (1.08, 1.08, 1.7))
        spike.rotation_euler.x = math.pi
        for i in range(3):
            add("torus", "Brass trace", parent, emissive if i == 1 else rim, (0, -.13 + i * .12, 0))
    elif kind == "portal":
        for radius, m in ((1.05, rim), (.84, emissive), (1.2, emissive)):
            ring = add("torus", "Portal ring", parent, m, (0, 0, 0), (radius, radius, radius))
            ring.rotation_euler.x = math.pi / 2
    elif kind == "crystal":
        for i in range(4):
            a = i * math.pi / 2
            add("ico", "Crystal", parent, emissive if i == 0 else base,
                (math.sin(a) * .23, .26, math.cos(a) * .23), (.3, .3, .3 * (1.7 + i * .2)))
    elif kind == "monolith":
        add("cylinder", "Monolith", parent, base, (0, .85, 0), (.3, .3, 1.7))
        add("cone", "Crown", parent, rim, (0, 1.83, 0), (.31, .31, .35))
        for i in range(3):
            ring = add("torus", "Rune", parent, emissive, (0, .4 + i * .4, 0), (.27, .27, .27))
    elif kind == "tower":
        parent.scale = (spec.get("width", 1), spec.get("width", 1), spec["scale"])
        add("cube", "Tower", parent, material("#1d2834", .02, .45, .35), (0, 0, 0), (.7, .7, 1))
        for i in range(6):
            for j in range(3):
                add("cube", "Window", parent, emissive, (-.21 + j * .2, -.4 + i * .16, .357), (.1, .01, .024))
    elif kind == "ground":
        add("cube", "Ground", parent, base, (0, -.04, 0), (120, 120, .08))
    elif kind == "rock":
        for i in range(4):
            add("ico", "Boulder", parent, base, ((i - 2) * .3, .12, math.sin(i * 2) * .3), (.42, .42, .26))
    elif kind == "arch":
        for x in (-.86, .86):
            add("cylinder", "Column", parent, base, (x, .9, 0), (.27, .27, 1.8))
        ring = add("torus", "Arch arc", parent, base, (0, 1.78, 0))
        ring.rotation_euler.x = math.pi / 2
        add("sphere", "Keystone", parent, rim, (0, 2.72, 0), (.15, .18, .15))
    elif kind == "orb":
        add("ico", "Luminous core", parent, emissive, (0, 0, 0), (.5, .5, .5))
        for i in range(3):
            ring = add("torus", "Orbital trace", parent, rim, (0, 0, 0), (.7, .7, .7))
            ring.rotation_euler = (math.pi / 2 + i * .6, i * .4, 0)
    elif kind == "cube":
        add("cube", "Cube", parent, base)
    elif kind == "sphere":
        add("sphere", "Sphere", parent, base, dims=(.5, .5, .5))
    return parent


def aim(camera, target):
    direction = v(target) - camera.location
    if direction.length > 1e-6:
        camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def interpolate(a, b, t):
    return [x + (y - x) * t for x, y in zip(a, b)]


def eased(t):
    t = max(0., min(1., t))
    return t * t * (3. - 2. * t)


def make_cameras(w, scene):
    fps = w["film"]["fps"]
    for shot in w["film"]["shots"]:
        cam_data = bpy.data.cameras.new("Haggs " + shot["id"])
        cam_data.lens = shot["lensMm"]
        camera = bpy.data.objects.new(shot["id"] + " " + str(shot["name"])[:60], cam_data)
        bpy.context.collection.objects.link(camera)
        first = int(round(shot["start"] * fps)) + 1
        last = int(round(shot["end"] * fps))
        marker = scene.timeline_markers.new(shot["id"], frame=first)
        marker.camera = camera
        if first == 1:
            scene.camera = camera
        for frame in range(first, last + 1):
            film_time = (frame - 1) / fps
            t = eased((film_time - shot["start"]) / (shot["end"] - shot["start"]))
            camera.location = v(interpolate(shot["from"], shot["to"], t))
            aim(camera, interpolate(shot["lookFrom"], shot["lookTo"], t))
            camera.keyframe_insert(data_path="location", frame=frame)
            camera.keyframe_insert(data_path="rotation_euler", frame=frame)


def configure_cycles(scene, preview, gpu):
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32 if preview else 128
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 960 if preview else 1920
    scene.render.resolution_y = 540 if preview else 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    if gpu:
        try:
            settings = bpy.context.preferences.addons["cycles"].preferences
            for backend in ("OPTIX", "CUDA", "METAL", "HIP"):
                try:
                    settings.compute_device_type = backend
                    settings.get_devices()
                    enabled = [d for d in settings.devices if d.type != "CPU"]
                    if enabled:
                        for d in enabled: d.use = True
                        scene.cycles.device = "GPU"
                        print("Haggs Worlds: using Cycles", backend, "devices", len(enabled))
                        break
                except Exception:
                    continue
            else:
                print("Haggs Worlds: GPU unavailable; CPU fallback")
        except Exception as err:
            print("Haggs Worlds: CPU fallback:", err)


def current_camera(scene, shots, frame):
    t = (frame - 1) / scene.render.fps
    shot = next((s for s in shots if t < s["end"]), shots[-1])
    cam = bpy.data.objects.get(shot["id"] + " " + str(shot["name"])[:60])
    if cam:
        scene.camera = cam


def main():
    user_args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Build an editable Haggs Worlds Blender film")
    parser.add_argument("--scene", required=True, help="Path to exported haggs-world.json")
    parser.add_argument("--out", default="./outputs/haggs-worlds", help="Local output folder")
    parser.add_argument("--preview", action="store_true", help="Render one low-cost frame per shot")
    parser.add_argument("--render", action="store_true", help="Render every film frame (CPU by default)")
    parser.add_argument("--gpu", action="store_true", help="Try installed Cycles GPU backend")
    args = parser.parse_args(user_args)
    w = read_scene(Path(args.scene).resolve())
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    SHADER_CACHE.clear()
    scene = bpy.context.scene
    scene.render.fps = w["film"]["fps"]
    scene.frame_start = 1
    scene.frame_end = int(round(w["film"]["duration"] * scene.render.fps))
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (.035, .07, .085, 1) if w["preset"] != "dunes" else (.12, .075, .055, 1)
        bg.inputs["Strength"].default_value = .38
    for spec in w["objects"]:
        add_obj(spec)
    env = w["environment"]
    sun_data = bpy.data.lights.new("Warm direction", "SUN")
    sun = bpy.data.objects.new("Sun", sun_data)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(24 + env["daylight"] * 42), math.radians(-18), math.radians(-30))
    sun_data.energy = 1.0 + env["daylight"] * 3.0
    sun_data.angle = math.radians(1.5)
    area_data = bpy.data.lights.new("Soft key", "AREA")
    area = bpy.data.objects.new("Softbox", area_data)
    bpy.context.collection.objects.link(area)
    area.location = (3, 2, 8); area_data.energy = 800; area_data.shape = "DISK"; area_data.size = 7
    make_cameras(w, scene)
    configure_cycles(scene, args.preview, args.gpu)
    scene.frame_set(1)
    current_camera(scene, w["film"]["shots"], 1)
    save_path = out / "haggs-world.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(save_path))
    print("Haggs Worlds: saved editable scene", save_path)
    if args.preview:
        for s in w["film"]["shots"]:
            frame = int(round(((s["start"] + s["end"]) / 2) * scene.render.fps)) + 1
            frame = min(scene.frame_end, max(1, frame))
            scene.frame_set(frame); current_camera(scene, w["film"]["shots"], frame)
            scene.render.filepath = str(out / ("preview-" + s["id"] + ".png"))
            bpy.ops.render.render(write_still=True)
    if args.render:
        configure_cycles(scene, False, args.gpu)
        for frame in range(scene.frame_start, scene.frame_end + 1):
            scene.frame_set(frame); current_camera(scene, w["film"]["shots"], frame)
            scene.render.filepath = str(out / ("frame_%04d.png" % frame))
            bpy.ops.render.render(write_still=True)
        print("Film frame sequence complete; use FFmpeg for MP4 and sound.")

if __name__ == "__main__":
    main()
