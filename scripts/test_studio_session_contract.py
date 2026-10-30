import importlib.util,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'public/workflows/world-motion-vfx/custom_nodes/ComfyUI-HaggsStudio'
spec=importlib.util.spec_from_file_location('studio_backend',root/'backend.py');backend=importlib.util.module_from_spec(spec);spec.loader.exec_module(backend)
def test_session_contract_uses_private_generated_id_and_config(tmp_path):
 ident,path=backend.create_session(tmp_path,character='robot',theme='temple',prompt='A room',service_url='http://127.0.0.1:8089')
 assert len(ident)==32 and all(c in '0123456789abcdef' for c in ident)
 assert backend.session_dir(tmp_path,ident)==path
 config=json.loads((path/'config.json').read_text());assert config['session']==ident and config['character']=='robot' and config['theme']=='temple'
 assert not (path/'recording.mp4').exists()
