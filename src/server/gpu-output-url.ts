/** Identifies only app-relative rented output references. Reading still requires the original account-bound connection. */
export function isGpuOutputUrl(value:string){
 try{if(!value.startsWith('/api/gpu/output?'))return false;const u=new URL(value,'https://haggs.invalid');return u.pathname==='/api/gpu/output'&&!u.hash&&u.search.length<=1000&&/^[a-f0-9]{32}$/.test(u.searchParams.get('endpoint')??'')&&/^[\w .-]{1,200}\.(mp4|webm|png|jpe?g|webp|mp3|flac|wav)$/i.test(u.searchParams.get('filename')??'')&&[...u.searchParams.keys()].every(k=>['endpoint','filename','subfolder'].includes(k));}catch{return false;}
}
