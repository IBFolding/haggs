import importlib.util,json,base64,io,csv
from pathlib import Path
from PIL import Image
import pytest
ROOT=Path(__file__).parents[1]
s=importlib.util.spec_from_file_location('backend',ROOT/'custom_nodes/ComfyUI-HaggsStudio/backend.py');b=importlib.util.module_from_spec(s);s.loader.exec_module(b)

def payload():
 stream=io.BytesIO();Image.new('RGB',(832,480),(20,30,40)).save(stream,format='JPEG');item='data:image/jpeg;base64,'+base64.b64encode(stream.getvalue()).decode()
 return {'frames':[item]*8,'fps':24,'events':[]}


def test_recording_writes_native_eden_manifest_and_video(tmp_path):
 import av
 ident,p=b.create_session(tmp_path,prompt='A room.')
 result=b.save_recording(tmp_path,ident,payload())
 assert result['frames']==8
 with av.open(str(p/'recording.mp4')) as f:assert len(list(f.decode(video=0)))==8
 rows=list(csv.DictReader((p/'manifest.csv').open()));assert rows[0]['proxy_video']=='recording.mp4'
 assert json.loads((p/'prompts.json').read_text())['staticPrompt']=='A room.'
 assert (p/'cover.png').is_file()


def test_reference_cover_is_preserved(tmp_path):
 ident,p=b.create_session(tmp_path);Image.new('RGB',(832,480),'red').save(p/'cover.png')
 config=json.loads((p/'config.json').read_text());config['reference_provided']=True;(p/'config.json').write_text(json.dumps(config))
 before=(p/'cover.png').read_bytes();b.save_recording(tmp_path,ident,payload());assert (p/'cover.png').read_bytes()==before


def test_register_is_idempotent_and_preserves_existing_games(tmp_path):
 ident,p=b.create_session(tmp_path/'sessions');b.save_recording(tmp_path/'sessions',ident,payload())
 games=tmp_path/'eden/realtime/games';games.mkdir(parents=True);reg=games/'registry.json';reg.write_text(json.dumps({'games':[{'slug':'original'}]}))
 a=b.register_room(tmp_path/'sessions',ident,tmp_path/'eden');bb=b.register_room(tmp_path/'sessions',ident,tmp_path/'eden');assert a==bb
 data=json.loads(reg.read_text());assert len(data['games'])==2 and data['games'][0]['slug']=='original'
 assert (games/a/'index.html').exists() and list(games.glob('registry.haggs-backup-*.json'))
 assert json.loads((games/a/'config.json').read_text())['session']==''


def test_session_path_cannot_escape(tmp_path):
 with pytest.raises(ValueError):b.session_dir(tmp_path,'../../outside')


def test_service_url_must_not_contain_credentials(tmp_path):
 with pytest.raises(ValueError):b.create_session(tmp_path,service_url='http://user:secret@localhost')


def test_eden_command_is_argument_list_and_uses_exact_manifest(tmp_path):
 repo=tmp_path/'repo with spaces';(repo/'edenlive/configs').mkdir(parents=True);(repo/'edenlive/configs/wan22_5b_720p_few_step.yaml').write_text('')
 py=tmp_path/'python';py.write_text('');weights=tmp_path/'weights'
 for name in ['dit-5b','vae-5b','umt5','scheduler-5b','vision-encoder']:(weights/name).mkdir(parents=True,exist_ok=True)
 session=tmp_path/'recording';session.mkdir();(session/'recording.mp4').write_bytes(b'fixture')
 cmd,cwd=b.eden_command(repo,py,weights,session,tmp_path/'out')
 assert cmd[1:3]==['-m','edenlive.scripts.infer'] and cwd==repo
 assert any(x.startswith('data.dataset.params.path=') and 'manifest.csv' in x for x in cmd)


def test_invalid_frame_dimensions_rejected(tmp_path):
 ident,_=b.create_session(tmp_path);buf=io.BytesIO();Image.new('RGB',(8,8)).save(buf,format='JPEG');item='data:image/jpeg;base64,'+base64.b64encode(buf.getvalue()).decode()
 with pytest.raises(ValueError):b.save_recording(tmp_path,ident,{'fps':24,'frames':[item]*2})
