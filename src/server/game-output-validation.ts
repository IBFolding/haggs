/** A strict manifest for a server-selected atlas. Never accept a URL from provider JSON. */
export function validateAtlasMetadata(data:Uint8Array,png:Uint8Array):{fps:number;frames:{frame:number;x:number;y:number;width:number;height:number}[]} {
 if(data.byteLength===0||data.byteLength>1_000_000||png.byteLength<24||png.byteLength>50_000_000)throw Error('Invalid atlas size.');
 const b=Buffer.from(png.buffer,png.byteOffset,png.byteLength);
 if(!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||b.toString('ascii',12,16)!=='IHDR')throw Error('Invalid atlas image.');
 const width=b.readUInt32BE(16),height=b.readUInt32BE(20);if(!width||!height||width>8192||height>8192||width*height>32_000_000)throw Error('Invalid atlas dimensions.');
 let parsed:unknown;try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));}catch{throw Error('Invalid atlas metadata.');}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Invalid atlas metadata.');
 const record=parsed as Record<string,unknown>;
 if(record.image!=='atlas.png'||typeof record.fps!=='number'||!Number.isFinite(record.fps)||record.fps<=0||record.fps>240||!Array.isArray(record.frames)||record.frames.length<1||record.frames.length>600)throw Error('Invalid atlas metadata.');
 const frames=record.frames.map((value,i)=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid atlas frame.');const f=value as Record<string,unknown>;
  const nums=[f.frame,f.x,f.y,f.width,f.height];if(nums.some(n=>typeof n!=='number'||!Number.isSafeInteger(n)))throw Error('Invalid atlas frame.');
  const [frame,x,y,w,h]=nums as number[];if(frame!==i||x!<0||y!<0||w!<=0||h!<=0||x!+w!>width||y!+h!>height)throw Error('Invalid atlas frame.');
  return {frame:frame!,x:x!,y:y!,width:w!,height:h!};});
 return {fps:record.fps,frames};
}
/** Branch titles become text in Haggs-owned UI; provider HTML is never accepted. */
export function validateBranchLabels(value:unknown):string[]{
 if(!Array.isArray(value)||value.length!==3||value.some(v=>typeof v!=='string'||!v.trim()||v.length>100||/[\u0000-\u001f\u007f]/.test(v)))throw Error('Invalid branch labels.');
 return value.map(v=>v.trim());
}
