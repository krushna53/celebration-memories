const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const vm=require('vm');const ts=require('typescript');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(n==='server-only')return {};if(n in mocks)return mocks[n];throw Error(n);}});return exports;}
const plans=load('lib/event-plans.ts');const id='11111111-1111-4111-8111-111111111111';
test('only known server-priced plans and valid Cashfree IDs are accepted',()=>{assert.equal(plans.isEventPlan('celebration'),true);assert.equal(plans.isEventPlan('__proto__'),false);assert.equal(plans.EVENT_PLANS.studio.amountPaise,249900);assert.equal(plans.localOrderId(plans.cashfreeOrderId(id)),id);assert.equal(plans.localOrderId('other_order'),null);});
function service({visible=true,paid=false,remoteStatus='PAID',amount=999,environment='production'}={}){
 const filters=[],calls=[];let fetched=0;
 const row={id,user_id:'buyer',status:paid?'paid':'pending',amount_paise:99900,currency:'INR',environment:'production'};
 const query={select(){return this;},eq(k,v){filters.push([k,v]);return this;},maybeSingle:async()=>({data:visible?row:null,error:null})};
 const db={from:()=>query,rpc:async(name,args)=>{calls.push({name,args});return {error:null};}};
 const cf=load('lib/cashfree.ts',{'@/services/cashfree-settings':{},'node:crypto':require('node:crypto')});
 const module=load('services/plan-orders.ts',{'@/lib/supabase/admin':{supabaseAdmin:()=>db},'@/services/cashfree-settings':{cashfreeSettings:async()=>({environment})},'@/lib/event-plans':plans,'@/lib/cashfree':{isCashfreeOrderPaid:cf.isCashfreeOrderPaid,getCashfreeOrder:async()=>{fetched++;return {order_id:plans.cashfreeOrderId(id),order_status:remoteStatus,order_amount:amount,order_currency:'INR'};}}});
 return {run:()=>module.reconcilePlanOrder(id,'buyer'),filters,calls,fetched:()=>fetched};
}
test('return page checks buyer ownership before reaching Cashfree',async()=>{const s=service({visible:false});await assert.rejects(s.run(),/not found/);assert.deepEqual(s.filters,[['id',id],['user_id','buyer']]);assert.equal(s.fetched(),0);});
test('only verified paid order reaches transactional fulfilment',async()=>{const s=service();assert.equal(await s.run(),'paid');assert.equal(s.calls[0].name,'confirm_plan_order');assert.equal(s.calls[0].args.verified_amount,99900);});
test('pending or mismatched payments cannot grant a purchase',async()=>{const p=service({remoteStatus:'ACTIVE'});assert.equal(await p.run(),'pending');assert.equal(p.calls.length,0);const m=service({amount:1});await assert.rejects(m.run(),/do not match/);assert.equal(m.calls.length,0);});
test('repeat confirmation is harmless and sandbox cannot reconcile production orders',async()=>{const p=service({paid:true});assert.equal(await p.run(),'paid');assert.equal(p.fetched(),0);const s=service({environment:'sandbox'});await assert.rejects(s.run(),/different payment environment/);assert.equal(s.fetched(),0);});
