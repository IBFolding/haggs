import {verifyUser, requestToken} from '../../../../../server/auth';
import {createManagedJobJournal} from '../../../../../server/managed-job-journal';
import {managedJobStatus} from '../../../../../server/managed-job-status';
import {createComfyManaged} from '../../../../../providers/comfy-managed';

/** Status can reconcile a journal record; it never submits a paid job. Disabled by default. */
export async function GET(request:Request, {params}:{params:Promise<{submission:string}>}) {
  const user = await verifyUser(request);
  const token = requestToken(request);
  if (!user || !token) return Response.json({error:'Sign in to check this job.'},{status:401,headers:{'Cache-Control':'no-store'}});
  const {submission} = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submission)) return Response.json({error:'Invalid job reference.'},{status:400,headers:{'Cache-Control':'no-store'}});
  const deployment=process.env.HAGGS_MANAGED_COMFY_URL, apiKey=process.env.HAGGS_MANAGED_COMFY_KEY;
  if (process.env.HAGGS_MANAGED_RECOVERY_ENABLED !== '1' || !deployment || !apiKey) return Response.json({error:'Managed job recovery is not configured.'},{status:503,headers:{'Cache-Control':'no-store'}});
  try {
    const journal=createManagedJobJournal(process.env,token);
    const provider=createComfyManaged({base:deployment,apiKey,keep:async()=>{throw new Error('Output storage is not configured.');}});
    const result=await managedJobStatus(user.id,submission,deployment,journal,provider);
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch {
    return Response.json({error:'Job status is unavailable. Do not submit the job again; try recovery later.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
