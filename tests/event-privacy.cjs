const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, URL, Date, Error, require: name => name === 'server-only' ? {} : mocks[name] ?? (()=>{throw new Error(name)})() });
  return exports;
}
const eventId = '10000000-0000-4000-8000-000000000001';
function access({ mode = 'public', pinned = false, status = 'active', published = true, user = null, role = null, member = null, invited = false, dbError = false } = {}) {
  const row = { id:eventId, slug:'test', status, page_status:published ? 'published':'unpublished', viewing_access:mode, public_access_pinned:pinned, owner_user_id:'host' };
  const db = { from(table) {
    const data = table === 'events' ? row : table === 'admins' ? role && {role} : table === 'admin_event_memberships' ? member && {role:member} : invited ? [{id:'guest'}] : [];
    const result = {data,error: dbError ? {message:'offline'} : null};
    const q = { select:()=>q,eq:()=>q,ilike:()=>q,maybeSingle:async()=>result,limit:async()=>result };return q;
  }};
  return load('services/event-access.ts', { '@/lib/supabase/admin':{supabaseAdmin:()=>db}, '@/lib/supabase/server':{supabaseServer:async()=>({auth:{getUser:async()=>({data:{user}})}})} });
}
test('public links stay anonymous; publication is independent of directory visibility', async()=>{
  assert.equal((await access().eventPermissions(eventId)).view,true);
  assert.equal((await access({published:false}).eventPermissions(eventId)).view,false);
  assert.equal((await access({status:'draft'}).eventPermissions(eventId)).view,false);
});
test('sign-in and guest-list gates fail closed and ignore editable metadata', async()=>{
  assert.equal((await access({mode:'signed_in'}).eventPermissions(eventId)).view,false);
  assert.equal((await access({mode:'signed_in',user:{id:'u'}}).eventPermissions(eventId)).view,true);
  assert.equal((await access({mode:'signed_in',user:{id:'u',is_anonymous:true}}).eventPermissions(eventId)).view,false);
  const user = {id:'guest',email:'guest@example.com',email_confirmed_at:'now',user_metadata:{role:'owner'}};
  assert.equal((await access({mode:'invited_only',user}).eventPermissions(eventId)).view,false);
  assert.equal((await access({mode:'invited_only',user,invited:true}).eventPermissions(eventId)).view,true);
  assert.equal((await access({mode:'invited_only',user:{...user,email_confirmed_at:null},invited:true}).eventPermissions(eventId)).view,false);
  await assert.rejects(access({dbError:true}).eventPermissions(eventId));
});
test('pinned events remain public; staff are not customer owners or managers', async()=>{
  assert.equal((await access({mode:'invited_only',pinned:true}).eventPermissions(eventId)).view,true);
  const staff = await access({mode:'invited_only',user:{id:'staff'},role:'owner',member:'client'}).eventPermissions(eventId);
  assert.equal(staff.view,false); assert.equal(staff.manage,false); assert.equal(staff.owner,false);
  assert.equal((await access({mode:'invited_only',user:{id:'team'},role:'client',member:'client'}).eventPermissions(eventId)).manage,true);
  assert.equal((await access({mode:'invited_only',user:{id:'session'},member:'session_organizer'}).eventPermissions(eventId)).manage,false);
});
const {safeAuthNext} = load('lib/auth-redirect.ts');
test('OAuth cannot redirect to another origin through encoding or backslashes',()=>{
  for(const input of ['https://evil.test','//evil.test','/\\evil.test','/%5cevil.test','/%0aevil.test']) assert.equal(safeAuthNext(input,'/safe'),'/safe');
  assert.equal(safeAuthNext('/events/test?gallery=1'),'/events/test?gallery=1');
});
function media({view = false, manage = false, platformAdmin = false, expiry = null, approved = false, queryError = false}={}) {
  const db = {from(){const q={select:()=>q,eq:()=>q,is:()=>q,limit:async()=>({data:approved?[{id:'media'}]:[],error:queryError?{}:null})}; return q;}};
  return load('services/media-access.ts', { 'next/headers':{cookies:async()=>({get:()=>null})}, '@/lib/supabase/admin':{supabaseAdmin:()=>db}, '@/services/event-access':{eventPermissions:async()=>({event:{status:'active'},view,manage,platformAdmin}),supportExpiry:async()=>expiry} });
}
test('media rechecks authorization, moderation and support expiration per request',async()=>{
  const path=eventId+'/guest/photo.jpg';
  assert.equal(await media().authorizeMedia('photos',path),null);
  assert.equal(await media({view:true}).authorizeMedia('photos',path),null);
  assert.ok(await media({view:true,approved:true}).authorizeMedia('photos',path));
  assert.equal(await media({view:true,approved:true,queryError:true}).authorizeMedia('photos',path),null);
  assert.ok(await media({manage:true}).authorizeMedia('photos',path));
  assert.equal(await media({platformAdmin:true,expiry:Date.now()-1}).authorizeMedia('photos',path),null);
  const allowed=await media({platformAdmin:true,expiry:Date.now()+25000}).authorizeMedia('photos',path);
  assert.ok(allowed.ttl>0&&allowed.ttl<=25); assert.equal(allowed.support,true);
  assert.equal(await media({manage:true}).authorizeMedia('photos',eventId+'/../other'),null);
});
