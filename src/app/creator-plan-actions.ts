'use server';
import {cookies} from 'next/headers';
import {z} from 'zod';
import {CLAUDE_COOKIE,claudeWorkspaceIn,keyIn} from '../server/keys';
import {askClaude} from '../writer/draft';
import {newBook,newPanelForPlan} from '../creators/plans';
import type {ComicBook} from '../comic/books';
import type {LookId,LayoutId} from '../comic/comic';
const planSchema=z.object({title:z.string().min(1).max(120),cast:z.string().max(6000),world:z.string().max(6000),chapters:z.array(z.object({title:z.string().max(120),pages:z.array(z.object({summary:z.string().max(1000),panels:z.array(z.object({action:z.string().min(6).max(2000),caption:z.string().max(200),dialogue:z.string().max(400)})).min(1).max(6)})).min(1).max(4)})).min(1).max(3)});
export async function planComic(idea:string,look:LookId,layout:LayoutId):Promise<{ok:true;book:ComicBook}|{ok:false;reason:string;needsKey?:boolean}>{
 if(typeof idea!=='string'||idea.trim().length<12||idea.length>12000)return {ok:false,reason:'Describe your story in 12–12,000 characters.'};
 if(!['custom','ink','manga','vector','noir','ligne','story'].includes(look)||!['page','strip','webtoon'].includes(layout))return {ok:false,reason:'Choose a supported comic style and format.'};
 const jar=await cookies(),key=keyIn(jar,CLAUDE_COOKIE);if(!key)return {ok:false,reason:'Add your Claude API key to plan this comic. No images were generated.',needsKey:true};
 const result=await askClaude({key,workspaceId:claudeWorkspaceIn(jar),request:{system:'You are a comic editor. Plan an original comic, preserving every supplied story fact. Return 1–3 chapters with 1–4 pages per chapter and 1–6 panels per page. Each action specifies framing, character blocking, expression and a concrete story event. Vary shot size and avoid redundant coverage. Use page turns for reveals. cast and world define continuity notes. Leave caption/dialogue empty when silence is stronger. Do not claim images were generated.',user:`Style: ${look}. Layout: ${layout}. Story: ${idea}`,maxTokens:10000},schema:z.toJSONSchema(planSchema),read:raw=>planSchema.parse(raw)});
 if(!result.ok)return {ok:false,reason:result.reason};
 const plan=result.draft,book=newBook(plan.title,idea,look,layout);book.cast=plan.cast;book.world=plan.world;book.chapters=plan.chapters.map((c,ci)=>({id:crypto.randomUUID(),title:c.title,pages:c.pages.map((p,pi)=>newPanelForPlan(`${ci+1}.${pi+1}`,p,look,layout))}));return {ok:true,book};
}

const shortPlanSchema=z.object({shots:z.array(z.object({role:z.string().min(1).max(240),visual:z.string().min(6).max(2000),voice:z.string().max(1000)})).min(6).max(12)});
export async function planShort(brief:string,style:string,structure:string[],seconds:number):Promise<{ok:true;shots:{role:string;visual:string;voice:string}[]}|{ok:false;reason:string;needsKey?:boolean}>{
 if(typeof brief!=='string'||brief.trim().length<12||brief.length>6000||typeof style!=='string'||style.length>2000||!Array.isArray(structure)||structure.length>20||!structure.every(s=>typeof s==='string'&&s.length<=500)||![15,30,45,60].includes(seconds))return {ok:false,reason:'Check the brief, style, structure and duration.'};
 const jar=await cookies(),key=keyIn(jar,CLAUDE_COOKIE);if(!key)return {ok:false,reason:'Add a Claude API key to write this shot proposal.',needsKey:true};
 const result=await askClaude({key,workspaceId:claudeWorkspaceIn(jar),request:{system:'Plan a short vertical film with 6–12 distinct, editable shots. Preserve supplied story facts. Each visual must contain concrete action, character continuity, camera framing and motivated movement. Follow the supplied structure where useful. Vary coverage; do not repeat the same establishing shot. Put spoken words in voice and leave empty where music or silence is stronger. Return a plan only; never claim media exists.',user:JSON.stringify({brief,style,structure,targetSeconds:seconds}),maxTokens:7000},schema:z.toJSONSchema(shortPlanSchema),read:raw=>shortPlanSchema.parse(raw)});
 return result.ok?{ok:true,shots:result.draft.shots}:{ok:false,reason:result.reason};
}
