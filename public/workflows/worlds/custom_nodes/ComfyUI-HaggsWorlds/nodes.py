"""Open-source Haggs Worlds ComfyUI data bridge. No models or paid endpoints.
Copy this folder to ComfyUI/custom_nodes/. Exported Haggs World JSON is pasted
into the first node, then one selected shot becomes text prompts and camera data
for your existing image/video workflow nodes.
"""
import json
import math

PRESETS = {"aether", "neon", "dunes"}
KINDS = {"island", "portal", "crystal", "monolith", "tower", "ground", "rock", "arch", "orb", "cube", "sphere"}


def parse_world(text):
    if not isinstance(text, str) or len(text.encode("utf-8")) > 2_000_000:
        raise ValueError("Haggs Worlds JSON must be under 2 MB.")
    w = json.loads(text)
    if not isinstance(w, dict) or w.get("version") != 1 or w.get("preset") not in PRESETS:
        raise ValueError("Requires a Haggs Worlds v1 JSON export.")
    objects = w.get("objects", [])
    film = w.get("film", {})
    shots = film.get("shots", [])
    if not isinstance(objects, list) or len(objects) > 600 or not isinstance(shots, list) or not 1 <= len(shots) <= 50:
        raise ValueError("Invalid objects or shots.")
    for o in objects:
        if o.get("kind") not in KINDS:
            raise ValueError("Unsupported Haggs world object kind.")
        if not isinstance(o.get("position"), list) or len(o["position"]) != 3:
            raise ValueError("Invalid object position.")
        if not all(isinstance(x, (int, float)) and math.isfinite(x) and abs(x) <= 500 for x in o["position"]):
            raise ValueError("Invalid object coordinates.")
    if not isinstance(film.get("fps"), int) or not 1 <= film["fps"] <= 60:
        raise ValueError("Invalid frame rate.")
    if not isinstance(film.get("duration"), (int, float)) or not 0 < film["duration"] <= 120:
        raise ValueError("Invalid duration.")
    last = 0
    for shot in shots:
        if not isinstance(shot.get("start"), (int, float)) or not isinstance(shot.get("end"), (int, float)) or abs(shot["start"] - last) > 1e-5 or shot["end"] <= last:
            raise ValueError("Discontinuous shot timeline.")
        for key in ("from", "to", "lookFrom", "lookTo"):
            v = shot.get(key)
            if not isinstance(v, list) or len(v) != 3 or not all(isinstance(x, (int, float)) and math.isfinite(x) for x in v):
                raise ValueError("Invalid film camera vector.")
        last = shot["end"]
    if abs(last - film["duration"]) > 1e-5:
        raise ValueError("Shots must cover the full film.")
    return w


def shot_data(w, index):
    shots = w["film"]["shots"]
    s = shots[max(0, min(len(shots) - 1, int(index)))]
    duration = s["end"] - s["start"]
    context = {
        "aether": "floating stone islands, monumental ancient architecture, atmospheric depth, magical realism",
        "neon": "cinematic neon-lit futuristic city, reflective surfaces, layered architecture, sophisticated light",
        "dunes": "vast sandstone desert ruins, sculptural rock, fine atmospheric sand, golden dusk",
    }[w["preset"]]
    objects = ", ".join(sorted(set(o["kind"] for o in w["objects"] if o["kind"] != "ground")))
    prompt = (
        "Cinematic, highly detailed environment. " + context +
        ". Set dressing: " + (objects or "minimal") +
        ". " + str(w.get("prompt", ""))[:1500] +
        ". Natural scale, realistic materials, purposeful composition, refined shadows, physically plausible atmosphere. " +
        "Shot: " + str(s.get("name", "Camera move"))[:120] + "."
    )
    camera = {
        "shot": s.get("id"), "name": s.get("name"), "start_seconds": s["start"], "end_seconds": s["end"],
        "position_start": s["from"], "position_end": s["to"],
        "target_start": s["lookFrom"], "target_end": s["lookTo"], "lens_mm": s["lensMm"],
        "fps": w["film"]["fps"], "frame_count": max(1, round(duration * w["film"]["fps"])),
        "world_preset": w["preset"], "seed": w.get("seed", 42),
    }
    return prompt, json.dumps(camera, separators=(",", ":")), camera["frame_count"]


class HaggsWorldLoad:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"world_json": ("STRING", {"multiline": True, "default": '{ "version": 1 }'})}}
    RETURN_TYPES = ("STRING", "INT", "INT")
    RETURN_NAMES = ("validated_world_json", "shot_count", "fps")
    FUNCTION = "load"
    CATEGORY = "Haggs/Worlds"

    def load(self, world_json):
        world = parse_world(world_json)
        return (json.dumps(world, separators=(",", ":")), len(world["film"]["shots"]), world["film"]["fps"])


class HaggsWorldShot:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"world_json": ("STRING", {"forceInput": True}), "shot_index": ("INT", {"default": 0, "min": 0, "max": 49, "step": 1})}}
    RETURN_TYPES = ("STRING", "STRING", "INT")
    RETURN_NAMES = ("visual_prompt", "camera_json", "frame_count")
    FUNCTION = "run"
    CATEGORY = "Haggs/Worlds"

    def run(self, world_json, shot_index):
        return shot_data(parse_world(world_json), shot_index)


NODE_CLASS_MAPPINGS = {"HaggsWorldLoad": HaggsWorldLoad, "HaggsWorldShot": HaggsWorldShot}
NODE_DISPLAY_NAME_MAPPINGS = {"HaggsWorldLoad": "Haggs · Load World", "HaggsWorldShot": "Haggs · Direct Shot"}
