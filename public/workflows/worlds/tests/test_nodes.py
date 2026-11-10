"""Model-free ComfyUI Haggs Worlds node bridge tests. Run: python3 -m unittest discover -s public/workflows/worlds/tests -v"""
import importlib.util
import json
from pathlib import Path
import unittest

NODE_FILE = Path(__file__).resolve().parents[1] / "custom_nodes" / "ComfyUI-HaggsWorlds" / "nodes.py"
spec = importlib.util.spec_from_file_location("haggs_world_nodes", NODE_FILE)
nodes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(nodes)


def example():
    return {
        "version": 1, "preset": "aether", "seed": 42,
        "prompt": "Floating lights over water", "objects": [
            {"id": "a", "kind": "island", "position": [0, 0, 0], "scale": 1, "color": "#c8ff2e"}
        ], "film": {"fps": 24, "duration": 10, "shots": [
            {"id": "S01", "name": "Reveal", "start": 0, "end": 5, "from": [5, 2, 3], "to": [2, 3, 4], "lookFrom": [0, 0, 0], "lookTo": [0, 1, 0], "lensMm": 35},
            {"id": "S02", "name": "Orbit", "start": 5, "end": 10, "from": [3, 5, 5], "to": [2, 3, -4], "lookFrom": [0, 1, 0], "lookTo": [0, 2, 0], "lensMm": 50},
        ]}
    }


class BridgeTests(unittest.TestCase):
    def test_valid_load_and_camera(self):
        text = json.dumps(example())
        clean, count, fps = nodes.HaggsWorldLoad().load(text)
        self.assertEqual((count, fps), (2, 24))
        visual, camera, frames = nodes.HaggsWorldShot().run(clean, 1)
        self.assertIn("floating stone islands", visual)
        self.assertEqual(frames, 120)
        self.assertEqual(json.loads(camera)["lens_mm"], 50)
    def test_discontinuous_cameras_rejected(self):
        world = example()
        world["film"]["shots"][1]["start"] = 6
        with self.assertRaises(ValueError):
            nodes.parse_world(json.dumps(world))
    def test_unrecognized_geometry_rejected(self):
        world = example()
        world["objects"][0]["kind"] = "__import__('os')"
        with self.assertRaises(ValueError):
            nodes.parse_world(json.dumps(world))
    def test_no_external_services(self):
        self.assertEqual(set(nodes.NODE_CLASS_MAPPINGS), {"HaggsWorldLoad", "HaggsWorldShot"})


if __name__ == "__main__":
    unittest.main()
