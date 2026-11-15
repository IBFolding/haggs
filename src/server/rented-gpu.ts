/** Server-only HTTPS transport for a user's authenticated ComfyUI gateway. */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';

export const RENTED_COOKIE = 'haggs_rented_gpu';
export type RentedConnection = { base: string; token: string; owner: string; expires: number };
const developmentGlobal=globalThis as typeof globalThis & {__haggsGpuEncryptionKey?:Buffer};
const developmentKey=developmentGlobal.__haggsGpuEncryptionKey ??= randomBytes(32);
function sealingKey() {
  const configured = process.env.HAGGS_GPU_CONNECTION_SECRET;
  if (configured && /^[a-f\d]{64}$/i.test(configured)) return Buffer.from(configured, 'hex');
  if (process.env.NODE_ENV === 'production') throw Error('The host must configure HAGGS_GPU_CONNECTION_SECRET before rented GPUs can connect.');
  return developmentKey;
}
export function rentedBase(input: string): string {
  if (typeof input !== 'string' || input.length > 300) throw Error('Enter the HTTPS root URL of your GPU gateway.');
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw Error('Enter the HTTPS root URL of your GPU gateway.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || isIP(url.hostname) || !/^[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(url.hostname) || !url.hostname.includes('.') || /\.(local|localhost|internal)$/i.test(url.hostname)) throw Error('Use a public HTTPS hostname with no path, port, password or query string.');
  return url.origin;
}
export function publicIPv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a=0,b=0] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || b === 2)) || (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0));
}
function validToken(token: string) {
  if (typeof token !== 'string' || token.length < 16 || token.length > 1024 || /[^\x21-\x7e]/.test(token)) throw Error('Enter the gateway bearer token (16–1024 characters), not your rental-provider API key.');
}
export function sealConnection(connection: RentedConnection): string {
  const base=rentedBase(connection.base); validToken(connection.token);
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', sealingKey(), iv);
  cipher.setAAD(Buffer.from(RENTED_COOKIE));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({...connection,base})), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function unsealConnection(value: string, owner: string): RentedConnection | undefined {
  try {
    if (value.length > 3500) return;
    const bytes = Buffer.from(value, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', sealingKey(), bytes.subarray(0,12));
    decipher.setAAD(Buffer.from(RENTED_COOKIE)); decipher.setAuthTag(bytes.subarray(12,28));
    const data = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString()) as RentedConnection;
    if (data.owner !== owner || !Number.isFinite(data.expires) || data.expires <= Date.now()) return;
    rentedBase(data.base); validToken(data.token); return data;
  } catch { return; }
}
export function allowedGpuRequest(url: URL, base: string, method: string): boolean {
  if (url.origin !== base || url.username || url.password || url.hash) return false;
  if (method === 'GET') return /^\/(system_stats|object_info|history\/[a-zA-Z0-9_-]+|view)$/.test(url.pathname) && (!url.search || url.pathname === '/view');
  return method === 'POST' && /^\/(prompt|upload\/image)$/.test(url.pathname) && !url.search;
}
/** DNS is resolved and pinned into the TLS socket on EVERY call. No redirects, proxy env, cookies or caller auth headers. */
export function rentedFetch(connection: Pick<RentedConnection,'base'|'token'>, authenticated = true, network = {lookup,request:httpsRequest}): typeof fetch {
  const base = rentedBase(connection.base); validToken(connection.token);
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const req = new Request(input, init), url = new URL(req.url);
    if (!allowedGpuRequest(url, base, req.method)) throw Error('That request is outside the GPU connection.');
    const answers = await network.lookup(url.hostname, {all:true, family:4});
    if (!answers.length || answers.some(a => !publicIPv4(a.address))) throw Error('The GPU hostname must resolve only to public IPv4 addresses.');
    const body = req.body ? Buffer.from(await req.arrayBuffer()) : undefined;
    if (body && body.byteLength > 50 * 1024 * 1024) throw Error('Keep GPU uploads under 50 MB.');
    const headers: Record<string,string> = {};
    if (authenticated) headers.Authorization = `Bearer ${connection.token}`;
    if (body) { headers['Content-Length'] = String(body.length); const type = req.headers.get('content-type'); if(type) headers['Content-Type'] = type; }
    return new Promise<Response>((resolve,reject) => {
      const fail = () => reject(Error('Could not reach the authenticated GPU gateway. No automatic retry was made.'));
      const outbound = network.request(url, {method:req.method, headers, agent:false, family:4, lookup: (_hostname,_options,done) => done(null,answers[0]!.address,4)}, incoming => {
        const status = incoming.statusCode ?? 502;
        if (status >= 300 && status < 400) { incoming.destroy(); fail(); return; }
        const chunks: Buffer[] = []; let size = 0;
        incoming.on('data', (chunk:Buffer) => { size += chunk.length; if(size > 100*1024*1024) { incoming.destroy(); fail(); } else chunks.push(chunk); });
        incoming.on('error',fail);
        incoming.on('end', () => resolve(new Response(status === 204 || status === 304 ? null : Buffer.concat(chunks), {status,headers:{'Content-Type':String(incoming.headers['content-type'] ?? 'application/octet-stream')}})));
      });
      const abort = () => outbound.destroy(Error('Aborted'));
      const timer = setTimeout(abort,120000);
      req.signal.addEventListener('abort',abort,{once:true});
      outbound.once('close',()=>{clearTimeout(timer);req.signal.removeEventListener('abort',abort);});
      outbound.on('error',fail);
      if(req.signal.aborted) { abort(); return; }
      outbound.end(body);
    });
  }) as typeof fetch;
}
export async function checkRented(connection: Pick<RentedConnection,'base'|'token'>, makeFetch = rentedFetch) {
  const base = rentedBase(connection.base);
  const anonymous = await makeFetch(connection,false)(`${base}/system_stats`,{signal:AbortSignal.timeout(10000)});
  if (![401,403].includes(anonymous.status)) throw Error('Protect the GPU endpoint with bearer authentication first. Public unauthenticated ComfyUI is not accepted.');
  const get = makeFetch(connection);
  const stats = await get(`${base}/system_stats`,{signal:AbortSignal.timeout(10000)});
  if(!stats.ok) throw Error('The gateway did not accept this bearer token. No render was submitted.');
  const data = await stats.json().catch(()=>{throw Error("Invalid GPU status response.");}) as {devices?:{name?:string}[]};
  if(!Array.isArray(data.devices) || !data.devices.some(d=>typeof d.name==='string')) throw Error('This endpoint did not return ComfyUI GPU status.');
  const response = await get(`${base}/object_info`,{signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw Error('The ComfyUI node catalog is unavailable.');
  const catalog = await response.json().catch(()=>{throw Error("Invalid GPU catalog response.");});
  if(!catalog || typeof catalog!=='object' || Array.isArray(catalog) || !Object.values(catalog).some(n=>n && typeof n==='object' && 'input' in n)) throw Error('This endpoint did not return a ComfyUI node catalog.');
  return {base,gpu:data.devices.find(d=>d.name)!.name!.slice(0,160),nodes:Object.keys(catalog).length};
}
