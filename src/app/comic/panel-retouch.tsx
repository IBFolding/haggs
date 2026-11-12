'use client';
import {useEffect,useState} from 'react';
import {quoteEdit,runEdit} from '../actions';
import {shrinkAll} from '../shrink';
import {openKeys} from '../nav';
import {creditsText} from '../../story/price-text';
export function PanelRetouch({picture,ratio,onPicture,onBusy}:{picture:string;ratio:string;onPicture:(url:string)=>void;onBusy:(busy:boolean)=>void}){
 const [prompt,setPrompt]=useState(''),[quote,setQuote]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>setQuote(null),[picture,prompt,ratio]);
 return <details><summary>Fine-tune this panel</summary><p className="wf-small">Describe one change and what must stay. The existing art remains available in Art versions.</p><textarea aria-label="Panel edit instruction" rows={2} value={prompt} maxLength={2000} onChange={e=>setPrompt(e.target.value)} placeholder="Move the letter to her right hand. Keep her face, outfit and lighting."/><button className="plain" disabled={busy||prompt.trim().length<4} onClick={async()=>{setBusy(true);setError('');try{const usd=await quoteEdit({tool:'kontext',frame:picture,prompt,ratio});if(!Number.isFinite(usd)||usd<=0)throw Error('A reliable edit price is unavailable.');setQuote(usd);}catch(e){setError(e instanceof Error?e.message:'Could not check the price.');}finally{setBusy(false);}}}>Check edit price</button>{quote!==null&&<button className="pill" disabled={busy} onClick={async()=>{setBusy(true);onBusy(true);setError('');try{const frame=(await shrinkAll([picture]))[0]!;const result=await runEdit({tool:'kontext',frame,prompt:`${prompt.trim()} Preserve all unrelated characters, composition and art style. Do not draw text or bubbles.`,ratio});if(result.ok){onPicture(result.url);setQuote(null);}else{setError(result.reason);if(result.needsKey)openKeys();}}catch{setError('The panel edit did not finish. No automatic retry was made.');}finally{setBusy(false);onBusy(false);}}}>Apply panel edit · about {creditsText(quote)}</button>}{error&&<p role="alert">{error}</p>}</details>;
}
