'use server';
import {userNow} from '../../../server/auth';
import {checkOwnedComfy} from '../../../server/comfy-owned-connection';

/** Explicitly gated preview. Key exists only for this request and is never saved. */
export async function checkConnection(address:string,key:string):Promise<{ok:boolean;message:string}> {
 if(process.env.HAGGS_OWN_COMFY_SETUP_PREVIEW!=='1') return {ok:false,message:'This connection is not available yet.'};
 if(!await userNow()) return {ok:false,message:'Sign in to check your deployment.'};
 if(typeof address!=='string'||address.length>300||typeof key!=='string'||!key.trim()||key.length>1000) return {ok:false,message:'Enter your deployment URL and API key.'};
 try { await checkOwnedComfy(address,key); return {ok:true,message:'Connection check passed. Your key was not saved; workflow runs are not available yet.'}; }
 catch { return {ok:false,message:'Could not verify this connection. Check your deployment URL and key; no workflow was submitted.'}; }
}
