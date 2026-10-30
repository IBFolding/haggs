HAGGS LOCAL COMFY NODE PACK

This installer copies three Haggs custom-node folders into an existing local
ComfyUI. It does not install ComfyUI, model weights, other vendors' nodes,
Python dependencies, a GPU driver, or a hosted service. It does not use credits.
The files in this bundle are open source; see the included pack licenses.

1. Extract this ZIP. Find your existing ComfyUI custom_nodes folder.
2. Open Terminal (Mac/Linux) or PowerShell (Windows) in the extracted folder.
3. First check the target, replacing the example path with your own:

   Mac/Linux:  python3 install.py "/path/to/ComfyUI/custom_nodes"
   Windows:    py install.py "C:\path\to\ComfyUI\custom_nodes"

4. If the check is ready, repeat the command with --install at the end.
   No existing node folder is overwritten. Restart ComfyUI afterward.

Some workflows also need additional nodes, model files and a suitable GPU.
Follow the setup links in Haggs before downloading those; model files can be
large and may have separate licenses. Partner models may use paid credits.
The hosted Haggs website cannot access a ComfyUI on your computer's localhost.
Use a local Haggs installation or a separately configured secure connection.
