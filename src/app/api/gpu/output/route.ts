import {readGpuOutput} from '../../../../server/gpu-connection';
export const runtime='nodejs';
/** Only the account holding the original sealed GPU connection can fetch its output. */
export async function GET(request:Request) {
  const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
  try {
    const url=new URL(request.url),response=await readGpuOutput(url.pathname+url.search);
    if(!response.ok)return Response.json({message:'The GPU result is unavailable.'},{status:404,headers});
    const mime=response.headers.get('content-type')?.split(';')[0]??'';
    if(!/^(image\/(png|jpeg|webp)|video\/(mp4|webm)|audio\/(mpeg|wav|x-wav|flac))$/.test(mime))return Response.json({message:'Unsupported GPU output type.'},{status:415,headers});
    const bytes=new Uint8Array(await response.arrayBuffer()),range=request.headers.get('range');
    const standard={...headers,'Content-Type':mime,'Accept-Ranges':'bytes'};
    if(range){
      const match=/^bytes=(\d+)-(\d*)$/.exec(range);
      const start=match?Number(match[1]):NaN,end=match&&match[2]?Number(match[2]):bytes.length-1;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||end>=bytes.length)return new Response(null,{status:416,headers:{...standard,'Content-Range':`bytes */${bytes.length}`}});
      return new Response(bytes.slice(start,end+1),{status:206,headers:{...standard,'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':String(end-start+1)}});
    }
    return new Response(bytes,{headers:{...standard,'Content-Length':String(bytes.length)}});
  }catch{return Response.json({message:'Reconnect the original GPU to access this output. Rental files are not backed up by this link.'},{status:410,headers});}
}
