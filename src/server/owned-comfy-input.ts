import {createHash} from 'node:crypto';
/** Checks a small signature only; callers must also decode/probe media before sending it to a provider. */
export function validateOwnedInput(field:string,mime:string,bytes:Uint8Array):{sha256:string;bytes:number}{
 if(bytes.length<12||bytes.length>100_000_000)throw Error('Input size is invalid.');
 const ascii=(start:number,end:number)=>Buffer.from(bytes.subarray(start,end)).toString('ascii');
 const video=field==='1/file'||field==='10001/file',audio=field==='10002/audio';
 if(!video&&!audio)throw Error('Unknown input.');
 const valid=video&&mime==='video/mp4'&&ascii(4,8)==='ftyp'||video&&mime==='video/webm'&&bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3||audio&&mime==='audio/wav'&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WAVE'||audio&&mime==='audio/flac'&&ascii(0,4)==='fLaC'||audio&&mime==='audio/mpeg'&&(ascii(0,3)==='ID3'||(bytes[0]===0xff&&((bytes[1]??0)&0xe0)===0xe0));
 if(!valid)throw Error('Input does not match its media type.');
 return {sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
}

/** Probe locally with strict time and output limits. A signature alone is not enough. */
export async function probeOwnedInput(field:string,mime:string,bytes:Uint8Array,options:{localTest?:boolean}={}):Promise<{sha256:string;bytes:number}>{
 if(process.env.NODE_ENV==='production'||options.localTest!==true)throw Error('Isolated media probing is not configured. No upload was started.');
 const info=validateOwnedInput(field,mime,bytes);
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');
 const {ffprobeBin}=await import('./ffmpeg');
 const dir=await mkdtemp(join(tmpdir(),'haggs-input-'));
 try {
  const path=join(dir,'media');await writeFile(path,bytes,{mode:0o600,flag:'wx'});
  const {stdout}=await promisify(execFile)(ffprobeBin(),['-v','error','-protocol_whitelist','file,pipe','-show_entries','stream=codec_type:format=duration','-of','json',path],{timeout:15000,maxBuffer:65536,windowsHide:true});
  const parsed=JSON.parse(stdout) as {streams?:{codec_type?:string}[];format?:{duration?:string}};
  const kind=field==='10002/audio'?'audio':'video',duration=Number(parsed.format?.duration);
  if(!Array.isArray(parsed.streams)||!parsed.streams.some(s=>s.codec_type===kind)||!Number.isFinite(duration)||duration<=0||duration>600)throw Error('Invalid media.');
  return info;
 }catch{throw Error('The media could not be verified. No upload was started.');}
 finally{await rm(dir,{recursive:true,force:true});}
}
