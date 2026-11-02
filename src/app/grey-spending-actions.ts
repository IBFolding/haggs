'use server';
import {cookies} from 'next/headers';
import {TOKEN_COOKIE,userNow} from '../server/auth';
import {greySpendingStore} from '../server/grey-spending';
export async function greySpendingStatus(){try{if(!await userNow())return {ok:false as const,reason:'Sign in to set your cap.'};const jar=await cookies();return {ok:true as const,status:await greySpendingStore(process.env,jar.get(TOKEN_COOKIE)?.value).status()};}catch{return {ok:false as const,reason:'Spending limits are not configured yet.'};}}
export async function setGreySpendingCap(cap:number){if(!Number.isFinite(cap)||cap<0||cap>10000||Math.abs(Math.round(cap*100)-cap*100)>0.000001)return {ok:false as const,reason:'Enter a dollar amount from 0 to 10,000 with at most two decimal places.'};try{if(!await userNow())return {ok:false as const,reason:'Sign in to set your cap.'};const jar=await cookies();const ok=await greySpendingStore(process.env,jar.get(TOKEN_COOKIE)?.value).setCap(cap);return ok?{ok:true as const}:{ok:false as const,reason:'The cap cannot be below charged and reserved spending.'};}catch{return {ok:false as const,reason:'The cap could not be saved.'};}}
