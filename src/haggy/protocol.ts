import {z} from 'zod';
export const PROTOCOL='haggs.personal-ai/2';
export const providerSchema=z.enum(['claude','codex']);
export type PersonalProvider=z.infer<typeof providerSchema>;
export const turnSchema=z.object({id:z.string().uuid(),provider:providerSchema,messages:z.array(z.object({role:z.enum(['user','assistant']),text:z.string().min(1).max(24000)}).strict()).min(1).max(40),context:z.object({page:z.string().max(400),project:z.string().max(100),board:z.string().max(100).optional()}).strict()}).strict().refine(v=>JSON.stringify(v).length<160000,'Conversation is too large. Start a new chat.');
export type PersonalTurn=z.infer<typeof turnSchema>;
export type ChatEvent={seq:number;type:'status'|'text'|'tool'|'done'|'error'|'canceled';text?:string;requestId?:string;name?:string;input?:Record<string,unknown>};
export const toolResponseSchema=z.object({id:z.string().uuid(),result:z.unknown(),error:z.boolean().optional()}).strict();
export function companionOrigin(value:string){const url=new URL(value);if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Use a loopback connector address such as http://127.0.0.1:3211.');return url.origin;}
export function allowedOrigin(origin:string,extra:string[]=[]){try{const u=new URL(origin);if(u.origin!==origin)return false;return extra.includes(origin)||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))||(u.protocol==='https:'&&(['haggs.vercel.app','haggsfield.studio','www.haggsfield.studio'].includes(u.hostname)||/^haggs-[a-z0-9]+-howardtherekts-projects\.vercel\.app$/.test(u.hostname)));}catch{return false;}}
