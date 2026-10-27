import type {ApiPrompt,Catalog} from './convert';
import type {Price} from './price';
/** Only complete partner-only graphs have a known platform reservation. Native GPU work is runtime-billed. */
export function boundedWorkflowCost(prompt:ApiPrompt,catalog:Catalog,price:Price):number|null {
 const utility=new Set(['LoadImage','LoadAudio','LoadVideo','SaveImage','SaveImageAdvanced','SaveVideo','SaveWEBM','SaveAudio','PreviewImage','CreateVideo','GetVideoComponents']);
 let total=0, charged=0;
 for(const [id,node] of Object.entries(prompt)) {
  const def=catalog[node.class_type];
  if(!def)return null;
  if(!def.api_node){if(!utility.has(node.class_type))return null;continue;}
  const p=price.nodes.find(p=>p.node===id);
  if(!p||p.approximate||!Number.isFinite(p.max)||p.max<=0)return null;
  let seconds=1;
  if(p.perSecond){
   const candidates=['duration','seconds','model.duration','video_duration'].filter(k=>k in node.inputs);
   if(candidates.length!==1)return null;
   const v=node.inputs[candidates[0]!];
   if(typeof v!=='number'||!Number.isFinite(v)||v<=0||v>3600)return null;
   seconds=v;
  }
  total+=p.max*seconds;charged++;
 }
 return charged&&Number.isFinite(total)&&total>0?total:null;
}
