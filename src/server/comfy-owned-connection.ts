/** A customer-owned managed Comfy deployment. Do not accept arbitrary origins:
 * this request carries the customer's secret from the server. */
export function ownedComfyOrigin(address:string):string {
  let url:URL;
  try { url=new URL(address.trim()); } catch { throw new Error('Enter your Comfy deployment URL.'); }
  if(url.protocol!=='https:' || !/^[a-z0-9-]+\.run\.comfy\.app$/.test(url.hostname) || url.username || url.password || url.port || url.pathname!=='/' || url.search || url.hash) throw new Error('Use the HTTPS deployment URL from your Comfy account.');
  return url.origin;
}

/** Read-only connection check. No workflows or paid jobs are submitted. */
export async function checkOwnedComfy(address:string,key:string,fetcher:typeof fetch=fetch):Promise<void> {
  const origin=ownedComfyOrigin(address);
  if(!key.trim()) throw new Error('Enter your Comfy API key.');
  let response:Response;
  try { response=await fetcher(`${origin}/api/v2/jobs?limit=1`,{headers:{Authorization:`Bearer ${key.trim()}`},redirect:'error',signal:AbortSignal.timeout(10000)}); }
  catch { throw new Error('Could not reach this deployment. No job was started.'); }
  if(!response.ok) throw new Error('Comfy did not accept this connection. Check the deployment and key. No job was started.');
  const data=await response.json().catch(()=>null) as {jobs?:unknown}|null;
  if(!data || !Array.isArray(data.jobs)) throw new Error('Comfy returned an unexpected response. No job was started.');
}
