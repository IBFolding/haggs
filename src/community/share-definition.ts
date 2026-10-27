/** Public templates retain graph wiring and model choices, never a creator's supplied inputs. */
export function shareDefinition(workflow:string):string {
 const graph=JSON.parse(workflow) as Record<string,{class_type?:unknown;inputs?:Record<string,unknown>}>;
 if(!graph||Array.isArray(graph)||typeof graph!=='object')throw new Error('This workflow is not a shareable node graph.');
 const enumKeys=/^(ckpt_name|unet_name|vae_name|clip_name[12]?|lora_name|sampler_name|scheduler|model|model_name|dtype|weight_dtype|device|type|format|codec)$/;
 const unsafe=/(?:https?:|file:|data:|blob:|\/Users\/|\/Volumes\/|\/home\/|Bearer\s|sk-[A-Za-z0-9]|[?&](?:token|key)=)/i;
 const out:Record<string,unknown>={};
 for(const [id,n] of Object.entries(graph)){
  if(!n||typeof n.class_type!=='string'||!n.inputs)throw new Error('Each shared node needs a type and inputs.');
  const inputs:Record<string,unknown>={};
  for(const [key,v] of Object.entries(n.inputs)){
   if(/key|token|password|secret|authorization|cookie/i.test(key))inputs[key]='';
   else if(Array.isArray(v)&&v.length===2&&typeof v[0]==='string'&&graph[v[0]]&&Number.isInteger(v[1]))inputs[key]=v;
   else if(typeof v==='number'||typeof v==='boolean'||v===null)inputs[key]=v;
   else if(typeof v==='string')inputs[key]=enumKeys.test(key)&&!unsafe.test(v)?v:'';
   else inputs[key]=null;
  }
  out[id]={class_type:n.class_type,inputs};
 }
 return JSON.stringify(out);
}
