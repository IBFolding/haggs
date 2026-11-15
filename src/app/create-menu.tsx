"use client";
import Link from 'next/link';
import {createPortal} from 'react-dom';
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
const TOOLS=[
 {href:'/photos',name:'Photos',detail:'Images, references and character looks'},
 {href:'/video',name:'Video',detail:'Generate a take from a prompt or image'},
 {href:'/shorts',name:'Shorts Studio',detail:'Start with a creator format and shot plan'},
 {href:'/comics',name:'Comic Studio',detail:'Build a book, page by page'},
 {href:'/coverage',name:'Shot coverage',detail:'Plan angles, lenses and camera movement'},
 {href:'/production-tools',name:'Production tools',detail:'Use connected specialist workflows'},
];
export function CreateMenu(){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
 const [position,setPosition]=useState<{top:number;left:number}|null>(null);
 const pathname=usePathname(),active=TOOLS.some(t=>pathname===t.href||pathname.startsWith(t.href+'/'));
 useEffect(()=>{if(!open)return;
  const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node)&&!menu.current?.contains(event.target as Node))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}};
  const focus=(event:FocusEvent)=>{if(!root.current?.contains(event.target as Node)&&!menu.current?.contains(event.target as Node))setOpen(false);};
  const resized=()=>setOpen(false);const focusFrame=requestAnimationFrame(()=>menu.current?.querySelector('a')?.focus({preventScroll:true}));
  window.addEventListener('resize',resized);
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);document.addEventListener('focusin',focus);
  return()=>{cancelAnimationFrame(focusFrame);window.removeEventListener('resize',resized);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);document.removeEventListener('focusin',focus);};
 },[open]);
 return <div ref={root} className="studio-create-root">
  <button ref={trigger} type="button" className={`nav-item studio-create-trigger`} aria-expanded={open} aria-controls="create-studio-menu" data-active={active} onClick={()=>{const rect=trigger.current?.getBoundingClientRect();setPosition(rect&&window.innerWidth>860?{top:rect.bottom+12,left:Math.max(12,Math.min(rect.left,window.innerWidth-544))}:null);setOpen(v=>!v);}}>Create <span aria-hidden="true">⌄</span></button>
  {open&&createPortal(<div ref={menu} id="create-studio-menu" className="studio-create-menu" style={position??undefined} onKeyDown={event=>{if(event.key==='Tab'&&event.shiftKey&&document.activeElement===menu.current?.querySelector('a')){event.preventDefault();setOpen(false);trigger.current?.focus();}}}>
   <div className="studio-create-heading"><b>What are you making?</b><span>Choose a starting point.</span></div>
   <nav aria-label="Creation studios" className="studio-create-links">{TOOLS.map(tool=><Link key={tool.href} href={tool.href} aria-current={pathname===tool.href?'page':undefined} onClick={()=>setOpen(false)}><b>{tool.name}</b><span>{tool.detail}</span></Link>)}</nav>
   <Link href="/library" className="studio-create-footer" onClick={()=>setOpen(false)}>Continue an existing project →</Link>
  </div>,document.body)}
 </div>;
}
