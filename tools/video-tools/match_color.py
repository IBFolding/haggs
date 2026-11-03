"""Match every frame's colour to one reference picture with color-matcher
(GPL-3.0, https://github.com/hahnec/color-matcher), run as a separate program.

usage: match_color.py reference.png in_dir out_dir method
"""
import os
import sys

from color_matcher import ColorMatcher
from color_matcher.io_handler import load_img_file, save_img_file
from color_matcher.normalizer import Normalizer

ref_path, src_dir, out_dir, method = sys.argv[1:5]
ref = load_img_file(ref_path)
cm = ColorMatcher()
for name in sorted(os.listdir(src_dir)):
    if not name.endswith(".png"):
        continue
    img = load_img_file(os.path.join(src_dir, name))
    out = cm.transfer(src=img, ref=ref, method=method)
    save_img_file(Normalizer(out).uint8_norm(), os.path.join(out_dir, name), "png")
