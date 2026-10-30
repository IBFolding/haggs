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
