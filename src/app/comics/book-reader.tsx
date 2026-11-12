'use client';
import {useState} from 'react';
import {LivingPage} from '../comic/living-page';
import {drawComic} from '../comic/draw';
import type {ComicBook} from '../../comic/books';
export function BookReader({book}:{book:ComicBook}){
 const [index,setIndex]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const pages=book.chapters.flatMap(c=>c.pages.map(page=>({chapter:c.title,page}))),current=pages[Math.min(index,pages.length-1)]!;
 async function printChapter(){
  const popup=window.open('','_blank');if(!popup)return setError('Allow the print preview window, then try again.');popup.opener=null;popup.document.title=book.title;setBusy(true);setError('');
  try{const style=popup.document.createElement('style');style.textContent='body{margin:0;background:#ddd;font-family:Arial}header{padding:18px}img{display:block;width:100%;height:auto;break-after:page;margin:0 auto;max-width:900px}@media print{body{background:white}header{display:none}img{max-width:100%;max-height:98vh;object-fit:contain}@page{margin:4mm}}';popup.document.head.appendChild(style);const header=popup.document.createElement('header');header.textContent=`${book.title} · ${current.chapter} — use Print, then Save as PDF. `;const button=popup.document.createElement('button');button.textContent='Print / Save as PDF';button.onclick=()=>popup.print();header.appendChild(button);popup.document.body.appendChild(header);
   const chapter=book.chapters.find(c=>c.pages.some(p=>p.id===current.page.id))!;
   for(const [pageIndex,page] of chapter.pages.entries()){const canvas=document.createElement('canvas'),d=page.draft;await drawComic(canvas,d.panels,d.pictures,d.layout,1,d.appearance,d.title,pageIndex+1);const image=popup.document.createElement('img');image.alt=page.title;image.src=canvas.toDataURL('image/png');popup.document.body.appendChild(image);}
  }catch(e){popup.close();setError(e instanceof Error?e.message:'Print preparation failed.');}finally{setBusy(false);}
 }
 return <details style={{margin:'24px 0',padding:18,border:'1px solid var(--line)',borderRadius:12}}><summary><b>Read this book · {pages.length} pages</b></summary><div className="sheet-row" style={{padding:'16px 0'}}><button className="plain" disabled={index<=0} onClick={()=>setIndex(i=>i-1)}>Previous page</button><label>Page<select aria-label="Comic reader page" value={Math.min(index,pages.length-1)} onChange={e=>setIndex(Number(e.target.value))}>{pages.map((p,i)=><option key={p.page.id} value={i}>{p.chapter} · {p.page.title}</option>)}</select></label><button className="plain" disabled={index>=pages.length-1} onClick={()=>setIndex(i=>i+1)}>Next page</button><button className="plain" disabled={busy} onClick={()=>void printChapter()}>{busy?'Preparing…':'Print chapter / Save as PDF'}</button></div>{error&&<p role="alert">{error}</p>}<LivingPage pageNumber={Math.min(index,pages.length-1)+1} panels={current.page.draft.panels} pictures={current.page.draft.pictures} animations={current.page.draft.animations??{}} title={current.page.draft.title} layout={current.page.draft.layout} {...(current.page.draft.appearance?{appearance:current.page.draft.appearance}:{})}/></details>;
}
