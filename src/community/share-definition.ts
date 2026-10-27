const enumKeys=/^(ckpt_name|unet_name|vae_name|clip_name[12]?|lora_name|sampler_name|scheduler|model|model_name|dtype|weight_dtype|device|type|format|codec)$/;
const unsafe=/(?:https?:|file:|data:|blob:|\/Users\/|\/Volumes\/|\/home\/|Bearer\s|sk-[A-Za-z0-9]|[?&](?:token|key)=)/i;
const secretKey=/key|token|password|secret|authorization|cookie/i;
/** A positional editor widget has no name, so only a model file or a short option label (sampler, seed control, "Gemini Nano Banana 2.1") is kept; prose and media names are not. */
const optionLike=(v:string)=>!unsafe.test(v)&&(/^[\w ./-]{1,160}\.(safetensors|ckpt|pt|pth|bin|gguf|sft|onnx)$/i.test(v)||/^[\w+.()-]+(?: [\w+.()-]+){0,4}$/.test(v)&&v.length<=48&&!/\.(png|jpe?g|webp|gif|mp4|mov|webm|wav|mp3|flac|m4a|txt|json)$/i.test(v));
const scrubValue=(key:string|null,v:unknown):unknown=>{
 if(key&&secretKey.test(key))return '';
 if(typeof v==='number'||typeof v==='boolean'||v===null)return v;
 if(typeof v==='string')return (key?enumKeys.test(key)&&!unsafe.test(v):optionLike(v))?v:'';
 return null;
};
const num=(v:unknown)=>typeof v==='number'||typeof v==='string'&&/^-?\d+(?::\d+)?$/.test(v)?v:null;
const pair=(v:unknown)=>Array.isArray(v)&&v.length>=2&&v.slice(0,2).every(x=>typeof x==='number')?[v[0],v[1]]:undefined;
const str=(v:unknown,max=80)=>typeof v==='string'&&!unsafe.test(v)?v.slice(0,max):undefined;

type UiNode={id?:unknown;type?:unknown;mode?:unknown;pos?:unknown;size?:unknown;inputs?:unknown;outputs?:unknown;widgets_values?:unknown};
function scrubNode(n:UiNode){
 if(!n||typeof n.type!=='string'||num(n.id)===null)throw new Error('Each shared node needs a type and an id.');
 const ports=(list:unknown,kind:'in'|'out')=>Array.isArray(list)?list.map((p:Record<string,unknown>)=>({name:str(p?.name)??'',type:str(p?.type)??'*',...(kind==='in'?{link:num(p?.link),...(p?.widget&&typeof p.widget==='object'?{widget:{name:str((p.widget as {name?:unknown}).name)??''}}:{})}:{links:Array.isArray(p?.links)?p.links.filter(l=>num(l)!==null):null,...(typeof p?.slot_index==='number'?{slot_index:p.slot_index}:{})})})):[];
 const values=n.widgets_values;
 const widgets_values=Array.isArray(values)?values.map(v=>scrubValue(null,v)):values&&typeof values==='object'?Object.fromEntries(Object.entries(values).map(([k,v])=>[k,scrubValue(k,v)])):[];
 return {id:n.id,type:n.type,...(typeof n.mode==='number'?{mode:n.mode}:{}),...(pair(n.pos)?{pos:pair(n.pos)}:{}),...(pair(n.size)?{size:pair(n.size)}:{}),inputs:ports(n.inputs,'in'),outputs:ports(n.outputs,'out'),widgets_values};
}
function scrubLinks(links:unknown):unknown[]{
 if(!Array.isArray(links))throw new Error('This workflow is not a shareable node graph.');
 return links.map(l=>Array.isArray(l)?[...l.slice(0,5).map(num),str(l[5])??'*']:{id:num(l?.id),origin_id:num(l?.origin_id),origin_slot:num(l?.origin_slot),target_id:num(l?.target_id),target_slot:num(l?.target_slot),type:str(l?.type)??'*'});
}
/** The editor's {nodes, links} document: layout, wiring and model choices stay; titles, notes, groups and supplied values go. */
function shareEditor(ui:{nodes:unknown[];links:unknown;definitions?:{subgraphs?:unknown}}):string{
 const subgraphs=Array.isArray(ui.definitions?.subgraphs)?ui.definitions.subgraphs.map((sg:Record<string,unknown>)=>{
  if(!sg||typeof sg.id!=='string'||!Array.isArray(sg.nodes))throw new Error('This workflow is not a shareable node graph.');
  const bound=(list:unknown)=>Array.isArray(list)?list.map((b:Record<string,unknown>)=>({name:str(b?.name)??'',type:str(b?.type)??'*',linkIds:Array.isArray(b?.linkIds)?b.linkIds.filter(l=>num(l)!==null):[]})):[];
  return {id:sg.id,nodes:sg.nodes.map(n=>scrubNode(n as UiNode)),links:scrubLinks(sg.links??[]),inputs:bound(sg.inputs),outputs:bound(sg.outputs)};
 }):[];
 return JSON.stringify({nodes:ui.nodes.map(n=>scrubNode(n as UiNode)),links:scrubLinks(ui.links),...(subgraphs.length?{definitions:{subgraphs}}:{})});
}

/** Public templates retain graph wiring and model choices, never a creator's supplied inputs. Saved apps hold the editor format; uploaded files may be either. */
export function shareDefinition(workflow:string):string {
 const graph=JSON.parse(workflow) as Record<string,{class_type?:unknown;inputs?:Record<string,unknown>}>;
 if(!graph||Array.isArray(graph)||typeof graph!=='object')throw new Error('This workflow is not a shareable node graph.');
 if(Array.isArray((graph as {nodes?:unknown}).nodes))return shareEditor(graph as unknown as {nodes:unknown[];links:unknown});
 const out:Record<string,unknown>={};
 for(const [id,n] of Object.entries(graph)){
  if(!n||typeof n.class_type!=='string'||!n.inputs)throw new Error('Each shared node needs a type and inputs.');
  const inputs:Record<string,unknown>={};
  for(const [key,v] of Object.entries(n.inputs)){
   if(!secretKey.test(key)&&Array.isArray(v)&&v.length===2&&typeof v[0]==='string'&&graph[v[0]]&&Number.isInteger(v[1]))inputs[key]=v;
   else inputs[key]=scrubValue(key,v);
  }
  out[id]={class_type:n.class_type,inputs};
 }
 return JSON.stringify(out);
}
