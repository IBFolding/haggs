import {createClient} from '@supabase/supabase-js';import type {RoomSession,RoomStore} from './room-session-transport';
/** Draft only. The caller must authenticate the owner before creating this store. */
export function createRoomStore(config:{url:string;key:string;secret:string;userToken:string}):RoomStore{
 const {url,key,secret,userToken}=config;if(!url||!key||!secret||!userToken)throw Error('Room storage is not configured.');
 const auth={persistSession:false,autoRefreshToken:false},admin=createClient(url,key,{auth}),mine=createClient(url,key,{auth,global:{headers:{Authorization:`Bearer ${userToken}`}}});
 return {
  async create(row){const {data,error}=await admin.rpc('room_session_create',{target:row.owner,session:row.id,p_deployment:row.deployment,secret});if(error)throw Error('Could not create room.');return data===true;},
  async read(owner,id){const {data,error}=await mine.from('room_sessions').select('id,owner,deployment,expires_at,state,recording_path,recording_bytes,recording_sha256').eq('owner',owner).eq('id',id).maybeSingle();if(error)throw Error('Room status unavailable.');if(!data)return null;const expiresAt=Date.parse(data.expires_at);if(!Number.isFinite(expiresAt))throw Error('Invalid room record.');return {id:data.id,owner:data.owner,deployment:data.deployment,expiresAt,state:data.state,...(data.recording_path?{recording:{path:data.recording_path,bytes:Number(data.recording_bytes),sha256:data.recording_sha256}}:{})} as RoomSession;},
  async claim(owner,id,recording){if(recording.path!==`rooms/u-${owner}/${id}/recording.mp4`)throw Error('Invalid recording path.');const {data,error}=await admin.rpc('room_session_claim',{target:owner,session:id,amount:recording.bytes,digest:recording.sha256,secret});if(error)throw Error('Could not claim recording.');return data===true;},
  async commit(owner,id,recording){if(recording.path!==`rooms/u-${owner}/${id}/recording.mp4`)throw Error('Invalid recording path.');const {data,error}=await admin.rpc('room_session_commit',{target:owner,session:id,amount:recording.bytes,digest:recording.sha256,secret});if(error)throw Error('Recording confirmation pending.');return data===true;},
 };
}
