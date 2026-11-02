import {verifyUser} from "../../../../server/auth";
import {hostedContext,hostedRecoveryEnabled,recoverHostedForRequest,confirmDeletedHostedForRequest} from "../../../../server/hosted-output-runtime";
import {allow,caller} from "../../../../server/limit";
const headers={"Cache-Control":"private, no-store"};
export async function GET(request:Request){
 if(!hostedRecoveryEnabled())return Response.json({ok:true,enabled:false,items:[]},{headers});
 const user=await verifyUser(request);if(!user)return Response.json({ok:false,reason:"Sign in first."},{status:401,headers});
 try{const context=await hostedContext(request);const {data,error}=await context.db.from("hosted_output_recovery").select("id,state,provider_job,filename,extension,created_at,url").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100);if(error)throw Error("Recovery journal could not be read.");return Response.json({ok:true,enabled:true,items:data},{headers});}catch{return Response.json({ok:false,reason:"Recovery journal is unavailable. Existing jobs were not repeated."},{status:503,headers});}
}
export async function POST(request:Request){
 if(!hostedRecoveryEnabled())return Response.json({ok:false,reason:"Hosted recovery is not enabled."},{status:503,headers});
 const user=await verifyUser(request);if(!user)return Response.json({ok:false,reason:"Sign in first."},{status:401,headers});
 try{if(new URL(request.headers.get("origin")??"").origin!==new URL(request.url).origin)return Response.json({ok:false,reason:"Not allowed."},{status:403,headers});}catch{return Response.json({ok:false,reason:"Not allowed."},{status:403,headers});}
 if(!allow(`hosted-recovery:${caller(request,user.id)}`,12,3600000))return Response.json({ok:false,reason:"Too many recovery requests. Check status before retrying."},{status:429,headers});
 if(Number(request.headers.get("content-length")??0)>1024)return Response.json({ok:false,reason:"Invalid recovery request."},{status:413,headers});
 let text="";const reader=request.body?.getReader();let bytes=0;
 try{if(reader)for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>1024)return Response.json({ok:false,reason:"Invalid recovery request."},{status:413,headers});text+=new TextDecoder().decode(part.value);}}finally{await reader?.cancel();}
 let body:{id?:unknown;action?:unknown};try{body=JSON.parse(text) as {id?:unknown;action?:unknown};}catch{return Response.json({ok:false,reason:"Invalid recovery request."},{status:400,headers});}
 if(!body||typeof body.id!=="string")return Response.json({ok:false,reason:"Choose a recovery record."},{status:400,headers});
 try{if(body.action==="confirm-deleted"){await confirmDeletedHostedForRequest(request,body.id);return Response.json({ok:true,deleted:true},{headers});}if(body.action!==undefined)return Response.json({ok:false,reason:"Invalid recovery action."},{status:400,headers});return Response.json({ok:true,url:await recoverHostedForRequest(request,body.id)},{headers});}catch(error){return Response.json({ok:false,reason:error instanceof Error?error.message:"Recovery is pending. No new generation was submitted."},{status:409,headers});}
}
