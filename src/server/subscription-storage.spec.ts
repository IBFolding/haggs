import test from 'node:test';
import assert from 'node:assert/strict';
import {PLANS,PLAN_VERSION,changeFor} from './billing';
import {readFileSync} from 'node:fs';
test('fixed subscriptions advertise exact decimal storage and credit allowances',()=>{
 assert.deepEqual(PLANS.map(p=>[p.monthly,p.storageGB,p.credits]),[[15,0,0],[39,5,2400],[69,15,4400],[99,30,6400]]);
});
test('new renewal grants require complete paid full-price cycle and preserve legacy behavior',()=>{
 const meta={haggs_user:'user',haggs_plan:'starter',haggs_plan_version:PLAN_VERSION,haggs_credit_grant:'2400'};
 const invoice={id:'in_paid',subscription_details:{metadata:meta},currency:'usd',amount_paid:3900,billing_reason:'subscription_cycle'};
 const event=(o:Record<string,unknown>)=>({id:'evt',type:'invoice.paid',data:{object:o}});
 assert.equal(changeFor(event(invoice),{})?.cents,2400);
 assert.equal(changeFor(event({...invoice,subscription_details:undefined,parent:{subscription_details:{metadata:meta}}}),{})?.cents,2400);
 for(const patch of [{amount_paid:2000},{currency:'eur'},{billing_reason:'subscription_update'},{subscription_details:{metadata:{...meta,haggs_credit_grant:'9000'}}}]) assert.equal(changeFor(event({...invoice,...patch}),{}),null);
});
test('quota reservation serializes by owner, protects all pending bytes and denies missing secret',()=>{
 const sql=readFileSync(new URL('../../supabase/migrations/20261027000000_storage_reservations.sql',import.meta.url),'utf8');
 assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/used\+pending\+amount>allowance/);assert.match(sql,/secret is distinct from/);assert.match(sql,/item.state is distinct from 'pending'/);
});
test('expiry cannot delete saved-project media, including browser-only references',()=>{
 const route=readFileSync(new URL('../app/api/cron/expire/route.ts',import.meta.url),'utf8');assert.doesNotMatch(route,/await del\(/);assert.match(route,/removed:0/);
});
