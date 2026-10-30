"use client";
import {useState} from 'react';
import Link from 'next/link';
import {Nav} from './nav';
import {WorkflowApp} from './workflows/[name]/workflow-app';

const choices = {
 image: [{name:'Z-Image Turbo · text to image',template:'image_z_image_turbo'}, {name:'Qwen · relight a photo',template:'image_qwen_image_edit_2509_relight'}],
 video: [{name:'Wan 2.1 · text to video',template:'text_to_video_wan'}, {name:'Wan 2.2 · swap a person',template:'template_purz_wan22_animate_auto_character_replace'}],
};
export function OpenWeightsStudio({kind}:{kind:'image'|'video'}) {
 const [selected,setSelected] = useState<string|null>(null);
 if(selected) return <WorkflowApp key={selected} name={selected} onBack={()=>setSelected(null)} />;
 return <div className="app"><Nav current={kind==='image'?'Photos':'Video'} /><main className="canvas"><h1>{kind==='image'?'Photos':'Video'} · Open weights</h1><p>Choose an open model. Each workflow checks the selected Comfy connection before generating. Availability depends on installed nodes and models.</p><p>Open weights does not connect a local GPU automatically. Configure ComfyUI in settings, or choose Comfy Cloud in the workflow.</p><div className="quick-grid">{choices[kind].map(c=><button className="pill" key={c.template} onClick={()=>setSelected(c.template)}>{c.name}</button>)}</div><p><Link href="/workflows/import">Open your own Comfy workflow</Link></p></main></div>;
}
