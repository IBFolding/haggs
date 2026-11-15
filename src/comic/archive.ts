/** Uncompressed ZIP for CBZ, with CRC32. Browser-only output; no upload or service required. */
export function zipFiles(files:{name:string;bytes:Uint8Array}[]):Uint8Array {
 if(!files.length||files.length>200)throw Error('Archive needs 1–200 files.');
 const encoder=new TextEncoder(),parts:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0;
 const crc=(bytes:Uint8Array)=>{let v=0xffffffff;for(const b of bytes){v^=b;for(let bit=0;bit<8;bit++)v=(v>>>1)^((v&1)?0xedb88320:0);}return (v^0xffffffff)>>>0;};
 for(const file of files){if(!/^[\w .-]{1,140}$/.test(file.name)||file.bytes.length>30*1024*1024)throw Error('Invalid archive entry.');
  const name=encoder.encode(file.name),sum=crc(file.bytes),header=new Uint8Array(30+name.length),view=new DataView(header.buffer);
  view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint32(14,sum,true);view.setUint32(18,file.bytes.length,true);view.setUint32(22,file.bytes.length,true);view.setUint16(26,name.length,true);header.set(name,30);
  const index=new Uint8Array(46+name.length),iv=new DataView(index.buffer);iv.setUint32(0,0x02014b50,true);iv.setUint16(4,20,true);iv.setUint16(6,20,true);iv.setUint32(16,sum,true);iv.setUint32(20,file.bytes.length,true);iv.setUint32(24,file.bytes.length,true);iv.setUint16(28,name.length,true);iv.setUint32(42,offset,true);index.set(name,46);central.push(index);parts.push(header,file.bytes);offset+=header.length+file.bytes.length;
  if(offset>200*1024*1024)throw Error('Export this book one chapter at a time; archive exceeds 200 MB.');
 }
 const centralLength=central.reduce((n,p)=>n+p.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,centralLength,true);ev.setUint32(16,offset,true);
 const result=new Uint8Array(offset+centralLength+22);let at=0;for(const part of [...parts,...central,end]){result.set(part,at);at+=part.length;}return result;
}
