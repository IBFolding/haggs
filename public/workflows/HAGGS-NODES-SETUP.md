# Haggs custom nodes: local setup

The Haggs node installer copies the included Effects, Game Director and HaggsStudio nodes into an existing ComfyUI installation. It does not install ComfyUI, Python packages, GPU drivers, model weights, other vendors' nodes or a hosted service. Models can be large and may have separate licenses. Partner nodes may use paid credits.

1. Download and extract the Haggs node installer ZIP from the Workflows page.
2. Find your existing ComfyUI `custom_nodes` folder. Open a terminal in the extracted `Haggs-Comfy-Nodes` folder.
3. Run the check, replacing the example with your own folder:

   - macOS/Linux: `python3 install.py "/path/to/ComfyUI/custom_nodes"`
   - Windows: `py install.py "C:\path\to\ComfyUI\custom_nodes"`

4. If the check reports ready, repeat the same command with `--install` at the end. Matching packs already present are kept and only missing packs are copied. Modified existing packs are not overwritten. Restart ComfyUI.
5. Choose a Haggs workflow. Read its individual setup notes before installing additional dependencies or models, and check the chosen runtime and price before running.

The hosted Haggs website cannot reach a ComfyUI running on your own computer's `localhost`. Use a local Haggs installation or a separately configured secure connection. The user-owned cloud connection is still under development; a successful connection check does not verify model or node availability. GPU generation is unverified. Illustrative images and synthetic examples are not evidence of a successful model render.

- [Effects setup, masks and limitations](/workflows/contest-lab/START-HERE.md)
- [Game Director setup and dependencies](/workflows/game-director/START-HERE.md)
- [World, Motion & VFX setup and dependencies](/workflows/world-motion-vfx/START-HERE.md)
- [Credits, sources and licenses](/workflows/PROVENANCE.md)
