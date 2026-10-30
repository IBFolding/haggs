'use client';
import {useEffect,useState} from 'react';
export function Preview(){const [action,setAction]=useState('walk'),[src,setSrc]=useState(''),[message,setMessage]=useState(''),[generated,setGenerated]=useState('');
 useEffect(()=>()=>{if(src)URL.revokeObjectURL(src);},[src]);
 return <main className="canvas"><h1>Game Director pose preview</h1><p>Local test: a procedural pose guide, not AI-generated footage. H3 generation requires a compatible GPU, nodes and model weights.</p><label>Action <select value={action} onChange={e=>setAction(e.target.value)}>{['idle','walk','attack','dodge','hit','victory'].map(a=><option key={a}>{a}</option>)}</select></label><button onClick={async()=>{setMessage('Preparing guide…');try{const r=await fetch('/api/game-director-fixture',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})});if(!r.ok)throw Error('Preview failed.');setSrc(URL.createObjectURL(await r.blob()));setGenerated(action);setMessage('Pose guide ready.');}catch{setMessage('Preview unavailable.');}}}>Preview pose</button><p role="status">{message}</p>{src&&<img src={src} alt={`Procedural ${generated} pose guide`} />}</main>;
}
