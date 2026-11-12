import {zipFiles} from '../comic/archive';
import {createMediaEnvelope} from './media-bundle';
import {exportProject,importBundle} from './transfer';
import {view,normalize} from './boards';
import {compileShot} from './compile';
import type {Project} from './model';
import type {Sheets} from '../sheets/sheets';

const FORMAT='haggs.production/1', LIMIT=128*1024*1024;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const csv=(s:unknown)=>{let text=String(s??'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;return `"${text.replace(/"/g,'""')}"`;};
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer)),b=>b.toString(16).padStart(2,'0')).join('');
const sensitive=/^(api[-_]?key|access[-_]?token|refresh[-_]?token|authorization|password|secret|credentials|hf_credentials|hf_key|comfy_api_key|connectionId|jobId|promptId|gatewayToken|endpointUrl)$/i;
/** Known connection/job fields are omitted. Prose is preserved: inspect your own notes before sharing. */
function portable(value:unknown):unknown {
 if(typeof value==='string'&&(value.startsWith('{')||value.startsWith('['))){try{return JSON.stringify(portable(JSON.parse(value)));}catch{return value;}}
 if(Array.isArray(value)) return value.map(portable);
 if(value&&typeof value==='object') return Object.fromEntries(Object.entries(value).filter(([k])=>!sensitive.test(k)).map(([k,v])=>[k,portable(v)]));
 return value;
}
function base64(bytes:Uint8Array){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
type FileEntry={name:string;bytes:Uint8Array};
type Manifest={format:string;files:{name:string;size:number;sha256:string}[];media:{id:string;name:string;type:string}[];externalLinks:string[]};

/** Stored-media pack; remote links are explicitly listed rather than fetched with user credentials. */
export async function productionPack(project:Project,sheets?:Sheets,fetcher:typeof fetch=fetch):Promise<Uint8Array>{
 const envelope=await createMediaEnvelope(portable(JSON.parse(exportProject(project,sheets))) as Record<string,unknown>,fetcher);
 const files:FileEntry[]=[],media:Manifest['media']=[];
 const attachments=envelope.mediaBundle.files;
 for(const [id,data] of Object.entries(attachments)) {
  const m=/^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(data);
  if(!m) throw Error('Invalid production media.');
  const ext:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov','audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/mp4':'m4a','audio/aac':'aac','audio/flac':'flac'};
  if(!ext[m[1]!])throw Error('Unsupported production media.');
  const name=`media-${media.length+1}.${ext[m[1]!]}`,bytes=Uint8Array.from(atob(m[2]!),c=>c.charCodeAt(0));
  files.push({name,bytes});media.push({id,name,type:m[1]!});
 }
 // The JSON stays small and editable; attachment bytes live beside it in the ZIP.
 const {mediaBundle:_,...content}=envelope;
 const dependencies=new Set<string>();
 const collect=(value:unknown):void=>{if(typeof value==='string'){if(/^(https?:|blob:|file:|\/)/.test(value))dependencies.add(value);else if(value.startsWith('{')||value.startsWith('[')){try{collect(JSON.parse(value));}catch{}}}else if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object')Object.values(value).forEach(collect);};
 collect(content);const externalLinks=[...dependencies];

 const add=(name:string,text:string)=>files.push({name,bytes:encoder.encode(text)});
 add('project.haggs.json',JSON.stringify(content,null,2));
 const normalized=normalize(content.project as Project),rows:string[]=[['Board','Shot','Heading','Beat','Seconds','Model','Camera','Light','Staging','Continuity warnings'].map(csv).join(',')];
 const briefs:unknown[]=[],script:string[]=[`# ${project.name}`],cards:string[]=[];
 for(const board of normalized.boards??[]) {
  const scoped=view(normalized,board.id);script.push(`\n## ${board.name}`);
  for(const [i,shot] of scoped.shots.entries()) {
   let warnings='',brief:ReturnType<typeof compileShot>|undefined;
   try{brief=compileShot(scoped,i);briefs.push({board:board.name,...brief});warnings=[...brief.blockers,...brief.warnings].join('; ');}catch{warnings='Model unavailable; choose a supported model before generation.';briefs.push({board:board.name,shotId:shot.id,error:warnings});}
   const direction={...scoped.direction,...shot.direction};
   rows.push([board.name,i+1,shot.heading,shot.beat,shot.seconds,shot.model.id,direction.camera,direction.light,direction.staging,warnings].map(csv).join(','));
   script.push(`\n### ${i+1}. ${shot.heading}\n${shot.beat}`, ...((shot.voices??[]).map(v=>`\n${v.speaker}: ${v.text}`)));
   const still=shot.render?.kind==='image'?shot.render.url:shot.startsFrom?.frameUrl??shot.refs?.[0];
   // Resolve only packed media, never load arbitrary external resources on opening the contact sheet.
   const packedProject=content.project as Project;
   const packed=normalize(packedProject).boards?.find(b=>b.id===board.id)?.shots.find(s=>s.id===shot.id);
   const ref=packed?.render?.kind==='image'?packed.render.url:packed?.startsFrom?.frameUrl??packed?.refs?.[0];
   const picture=still?media.find(m=>m.id===ref)?.name??'':'';
   cards.push(`<article>${picture?`<img src="${escape(picture)}" alt="${escape(shot.heading)}">`:'<div class="missing">No packed storyboard still</div>'}<h2>${i+1}. ${escape(shot.heading)}</h2><p>${escape(shot.beat)}</p><small>${escape(board.name)} · ${escape(direction.camera)}</small></article>`);
  }
 }
 add('script.md',script.join('\n'));
 add('shots.csv',rows.join('\r\n'));
 add('continuity.json',JSON.stringify({format:'haggs.continuity/1',media,shots:portable(briefs)},null,2));
 add('contact-sheet.html',`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'"><title>${escape(project.name)}</title><style>body{font:16px system-ui;background:#151515;color:#eee;padding:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}article{background:#242424;padding:16px}img,.missing{width:100%;height:180px;object-fit:contain}.missing{display:grid;place-items:center;color:#aaa}h2{font-size:18px}</style><h1>${escape(project.name)}</h1><p>Storyboard stills and reference frames; not a rendered film.</p><main>${cards.join('')}</main></html>`);
 add('README.txt',`Haggs production pack\n\nImport this .zip through Projects to create a new project. Unzip to read script.md, shots.csv, continuity.json and contact-sheet.html.\n\nMedia is limited to 30 MB per file, 128 MB total, 193 attachments. Unsupported or inaccessible stored media stops export. Unbundled links (${externalLinks.length}) remain links and require their original host; see manifest.json. Video shots without stills are labelled in the contact sheet.\n\nKnown credential and job binding fields are omitted. Notes, scripts, imported workflows and prompts remain your content: inspect before public sharing. Provider accounts, model weights, API keys and software licences are not included. Restore may use storage quota; no generation starts. Partial upload failures can leave account files, but do not save a project.\n\nInspired by Slate production packaging and continuity compilation by Keys and Sam Wasserman / Wasserman Productions. This TypeScript implementation uses Haggs' existing project and generation contracts.\n`);
 const manifest:Manifest={format:FORMAT,media,externalLinks,files:await Promise.all(files.map(async f=>({name:f.name,size:f.bytes.length,sha256:await hash(f.bytes)})))};
 add('manifest.json',JSON.stringify(manifest,null,2));
 if(files.reduce((n,f)=>n+f.bytes.length,0)>LIMIT)throw Error('Production pack exceeds 128 MB. Export a smaller project or use project links.');
 if(files.some(f=>f.bytes.length>30*1024*1024))throw Error('Production pack limit: 30 MB per file. Export large media separately.');
 return zipFiles(files);
}

/** Accept only our flat, uncompressed ZIP dialect. No extraction to disk, redirects, executable HTML or uploads during inspection. */
export async function readProductionPack(bytes:Uint8Array):Promise<Record<string,unknown>> {
 if(bytes.length>LIMIT+1024*1024||bytes.length<22)throw Error('Invalid production pack size.');
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),files=new Map<string,Uint8Array>(),locations=new Map<string,number>();let offset=0;
 while(offset+30<=bytes.length&&dv.getUint32(offset,true)===0x04034b50){
  const flags=dv.getUint16(offset+6,true),method=dv.getUint16(offset+8,true),size=dv.getUint32(offset+18,true),raw=dv.getUint32(offset+22,true),len=dv.getUint16(offset+26,true),extra=dv.getUint16(offset+28,true);
  const end=offset+30+len+extra+size;
  if(flags||method||size!==raw||size>30*1024*1024||end>bytes.length||extra)throw Error('Unsupported or damaged production ZIP.');
  const name=decoder.decode(bytes.subarray(offset+30,offset+30+len));
  if(!/^[\w .-]{1,140}$/.test(name)||name==='.'||name==='..'||files.has(name)||files.size>=200)throw Error('Unsafe or duplicate production entry.');
  locations.set(name,offset);files.set(name,bytes.slice(offset+30+len,end));offset=end;
 }
 // Require a complete central directory and terminal record, not an arbitrary prefix.
 const centralStart=offset;
 let count=0;
 const indexed=new Set<string>();
 while(offset+46<=bytes.length&&dv.getUint32(offset,true)===0x02014b50){
  const len=dv.getUint16(offset+28,true),extra=dv.getUint16(offset+30,true),comment=dv.getUint16(offset+32,true);
  if(offset+46+len+extra+comment>bytes.length)throw Error('Damaged ZIP directory.');
  const name=decoder.decode(bytes.subarray(offset+46,offset+46+len)),local=locations.get(name);
  if(local===undefined||indexed.has(name)||extra||comment||dv.getUint16(offset+8,true)||dv.getUint16(offset+10,true)||dv.getUint32(offset+42,true)!==local||dv.getUint32(offset+20,true)!==files.get(name)!.length||dv.getUint32(offset+24,true)!==files.get(name)!.length||dv.getUint32(offset+16,true)!==dv.getUint32(local+14,true))throw Error('Damaged ZIP directory.');
  indexed.add(name);offset+=46+len;count++;
 }
 if(offset+22!==bytes.length||dv.getUint32(offset,true)!==0x06054b50||dv.getUint16(offset+4,true)||dv.getUint16(offset+6,true)||dv.getUint16(offset+20,true)||dv.getUint16(offset+8,true)!==files.size||dv.getUint16(offset+10,true)!==count||count!==files.size||dv.getUint32(offset+16,true)!==centralStart||dv.getUint32(offset+12,true)!==offset-centralStart)throw Error('Incomplete production ZIP.');
 const json=(name:string)=>{const data=files.get(name);if(!data)throw Error(`Missing ${name}.`);return JSON.parse(decoder.decode(data));};
 const manifest=json('manifest.json') as Manifest;
 if(manifest.format!==FORMAT||!Array.isArray(manifest.files)||!Array.isArray(manifest.media)||manifest.media.length>193||manifest.files.length!==files.size-1)throw Error('Invalid production manifest.');
 const checked=new Set<string>();
 for(const entry of manifest.files){const data=files.get(entry.name);if(!data||entry.name==='manifest.json'||checked.has(entry.name)||data.length!==entry.size||await hash(data)!==entry.sha256)throw Error('Production attachment integrity check failed.');checked.add(entry.name);}
 const content=json('project.haggs.json') as Record<string,unknown>;
 if(content.mediaBundle)throw Error('Unexpected embedded media manifest.');
 importBundle(JSON.stringify(content));
 const attachments:Record<string,string>={};
 for(const item of manifest.media){if(!/^haggs-bundle:[0-9]+$/.test(item.id)||attachments[item.id]||!checked.has(item.name)||!/^(image\/(png|jpeg|webp)|video\/(mp4|webm|quicktime)|audio\/(mpeg|mp4|aac|flac|wav|x-wav))$/.test(item.type))throw Error('Invalid production media manifest.');attachments[item.id]=`data:${item.type};base64,${base64(files.get(item.name)!)}`;}
 const validate=(v:unknown):void=>{if(typeof v==='string'){if(v.startsWith('haggs-bundle:')&&!attachments[v])throw Error('A production media attachment is missing.');if(v.startsWith('{')||v.startsWith('[')){let parsed:unknown;try{parsed=JSON.parse(v);}catch{return;}validate(parsed);}}else if(Array.isArray(v))v.forEach(validate);else if(v&&typeof v==='object')Object.values(v).forEach(validate);};
 validate(content);
 return {...content,mediaBundle:{format:'haggs.media/1',files:attachments}};
}
