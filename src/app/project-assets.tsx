"use client";
import {useState} from 'react';
import {BankPicker} from './bank-picker';
import {BuildLink} from './return-bar';
import {EditorDialog} from './board/[id]/cut/editor-dialog';
import {createRunStore, type Run} from '../story/runs';
import {defaultKv} from '../story/kv';
import type {BankItem} from '../story/bank';
export function ProjectAssets({onPick,beforeBuild,kinds=['character','place']}:{onPick:(item:BankItem)=>void;beforeBuild:()=>Promise<void>;kinds?:('character'|'place')[]}) {
 const [bank,setBank]=useState(false),[gallery,setGallery]=useState<Run[]|null>(null),[kind,setKind]=useState<'character'|'place'>(kinds[0]!),[name,setName]=useState(''),[error,setError]=useState('');
 const accept=(item:BankItem)=>{if(!item.image){setError('Finish and save this asset with a picture first.');return;}onPick(item);setError('');};
 return <div className="project-assets"><div className="cm-row">
 <button className="pill" onClick={()=>setBank(true)}>Choose saved {kinds.length===1?(kinds[0]==='character'?'character':'location'):'characters / locations'}</button>
 <button className="plain" onClick={()=>void createRunStore(defaultKv()).list().then((items)=>setGallery(items.filter((r)=>r.kind==='image'))).catch(()=>setError('Gallery could not be opened. Your draft is unchanged.'))}>Choose from Gallery</button>
 {kinds.includes('character')&&<BuildLink href="/characters" label="your project draft" beforeNavigate={beforeBuild} className="plain">Create in Characters →</BuildLink>}
 {kinds.includes('place')&&<BuildLink href="/locations" label="your project draft" beforeNavigate={beforeBuild} className="plain">Create in Locations →</BuildLink>}
 </div><p className="wf-small">Existing references are reused. Create new characters and locations in their own sections, then return with the completed asset.</p>
 {error&&<p role="alert">{error}</p>}
 {bank&&<BankPicker kinds={kinds} label="your project draft" onPick={accept} onClose={()=>setBank(false)} beforeBuild={beforeBuild} allowPhotoBuild={false}/>}
 {gallery&&<EditorDialog label="Choose project reference from Gallery" onClose={()=>setGallery(null)}><button className="plain" onClick={()=>setGallery(null)}>Close Gallery</button><h2>Choose an existing image</h2>
 <label>Use as<select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}>{kinds.includes('character')&&<option value="character">Character</option>}{kinds.includes('place')&&<option value="place">Location</option>}</select></label>
 <label>Project name for this reference<input value={name} maxLength={60} onChange={e=>setName(e.target.value)} placeholder="For example: Mara or Desert saloon"/></label>
 <p className="wf-small">This links a finished Gallery image to the project; it does not create a duplicate bank asset.</p>
 {!gallery.length&&<p>No finished images in Gallery. Create and save an asset in its dedicated section.</p>}
 <div className="bank-grid">{gallery.map(r=><button key={r.id} disabled={!name.trim()} onClick={()=>{accept({id:`gallery-${r.id}`,kind,name:name.trim(),image:r.url,words:r.prompt});setGallery(null);}} aria-label={`Use ${r.modelName} image`}><img src={r.url} alt={r.prompt.slice(0,80)}/></button>)}</div></EditorDialog>}
 </div>;
}
