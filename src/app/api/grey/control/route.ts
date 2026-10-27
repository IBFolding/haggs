import {spawn} from 'node:child_process';
import {mkdir,open,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {bridgeAllowed} from '../../../../server/bridge-guard';
import {hosted} from '../../../../server/blob';
import {ffmpegBin} from '../../../../server/ffmpeg';
import {controlSpec,controlTime,depthFrame} from '../../../../story/trajectory-control';
import {trajectoryWorkflow} from '../../../../comfy/trajectory-vace';
import {poseExport,type Trajectory} from '../../../../story/trajectory';
export const maxDuration=300;
/** CPU-only local preparation. No provider call or automatic media synchronization. */
export async function POST(request:Request){
 if(hosted()||!bridgeAllowed(request))return new Response('Local development only',{status:404});
 const root=process.env.HAGGS_LOCAL_MEDIA;if(!root)return Response.json({ok:false,reason:'Local media folder is not configured.'},{status:400});
 let dir:string|undefined;
 try{
  const body=await request.json() as {trajectory:Trajectory;vertical?:boolean;prompt:string};
  const t=body.trajectory,s=controlSpec(t,body.vertical),graph=trajectoryWorkflow(t,!!body.vertical,body.prompt);
  if(t.seconds>6)throw Error('Prepare a path up to six seconds for this first integration. Your longer path remains saved.');
  const id=crypto.randomUUID();dir=join(root,'camera-controls',id);await mkdir(dir,{recursive:true});
  const raw=join(dir,'depth.gray'),handle=await open(raw,'w');
  try{for(let i=0;i<s.frames;i++){if(request.signal.aborted)throw Error('Preparation cancelled.');await handle.write(depthFrame(t,controlTime(t,i,s.frames),s.width,s.height));await new Promise(resolve=>setImmediate(resolve));}}finally{await handle.close();}
  await new Promise<void>((resolve,reject)=>{
   const child=spawn(ffmpegBin(),['-loglevel','error','-y','-f','rawvideo','-pixel_format','gray','-video_size',`${s.width}x${s.height}`,'-framerate',String(s.fps),'-i',raw,'-an','-c:v','libx264','-crf','0','-pix_fmt','yuv420p',join(dir!,'haggs-depth-control.mp4')],{stdio:'ignore'});
   const stop=()=>child.kill('SIGTERM');request.signal.addEventListener('abort',stop,{once:true});
   child.once('error',()=>{request.signal.removeEventListener('abort',stop);reject(Error('Local ffmpeg could not start.'));});
   child.once('close',code=>{request.signal.removeEventListener('abort',stop);code===0&&!request.signal.aborted?resolve():reject(Error('Depth encoding failed or was cancelled.'));});
  });
  await rm(raw);await writeFile(join(dir,'workflow.api.haggs.json'),JSON.stringify(graph,null,2));
  await writeFile(join(dir,'poses.haggs.json'),JSON.stringify({...poseExport(t),conditioning:{...s,frames:undefined,times:Array.from({length:s.frames},(_,i)=>controlTime(t,i,s.frames)),geometry:'Proxy boxes and ground, not reconstructed reference geometry',depth:'Fixed axial depth: 0.1m white to 40m black'}},null,2));
  const base=`/api/local/camera-controls/${id}`;
  return Response.json({ok:true,video:`${base}/haggs-depth-control.mp4`,workflow:`${base}/workflow.api.haggs.json`,poses:`${base}/poses.haggs.json`,...s,preparedAt:Date.now()});
 }catch(e){if(dir)await rm(dir,{recursive:true,force:true});return Response.json({ok:false,reason:e instanceof Error?e.message:'Control preparation failed.'},{status:400});}
}
