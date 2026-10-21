const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto').webcrypto;
(async()=>{
 const context=vm.createContext({crypto,Error,Map});vm.runInContext(fs.readFileSync(__dirname+'/privacy.js','utf8'),context);
 const cleared=[];const registry=context.ReadSessions.create(async lease=>cleared.push(lease.tabId));
 assert.throws(()=>registry.requireAccess(1),/locked/);
 let lease=await registry.open(1);assert.throws(()=>registry.requireAccess(1),/locked/);
 const first=registry.allow(lease);assert.equal(registry.requireAccess(1,first),lease);
 assert.throws(()=>registry.requireAccess(1,'wrong'),/locked/);assert.throws(()=>registry.requireAccess(2,first),/locked/);
 lease.auto=true;lease.reference='private passage';lease.lookup=true;
 await registry.close(lease);assert.equal(lease.allowed,false);assert.equal(lease.reference,'');assert.equal(lease.lookup,false);assert.equal(lease.auto,false);assert.equal(lease.token,null);assert.deepEqual(cleared,[1]);
 const fresh=await registry.open(1);assert.throws(()=>registry.requireAccess(1,first),/locked/);const second=registry.allow(fresh);assert.notEqual(second,first);
 await registry.close(lease);assert.equal(registry.requireAccess(1,second),fresh);
 await registry.close(fresh);assert.throws(()=>registry.requireAccess(1,second),/locked/);
 // The actual page script must reject reads BEFORE touching question DOM.
 let listener,queries=0,timers=0;
 const page=vm.createContext({console,Error,Set,Map,Promise,globalThis:null,
  document:{documentElement:{},querySelectorAll(){queries++;throw Error('Unexpected DOM read');}},
  addEventListener:()=>{},MutationObserver:class{observe(){}},setTimeout:()=>{timers++;return 1},clearTimeout:()=>{},
  QuizCoachFlow:{},chrome:{runtime:{onMessage:{addListener:f=>listener=f},sendMessage:async()=>({allowed:false})},storage:{onChanged:{addListener:()=>{}}}}
 });page.globalThis=page;
 vm.runInContext(fs.readFileSync(__dirname+'/runner.js','utf8'),page);
 vm.runInContext(fs.readFileSync(__dirname+'/content.js','utf8'),page);
 async function send(message){return new Promise(resolve=>listener(message,{},resolve));}
 for(const type of ['collect','select','fill','wake']){const r=await send({type,token:'old'});assert.match(r.error,/locked/);}
 const denied=await send({type:'authorize',token:'fake'});assert.match(denied.error,/locked/);assert.equal(queries,0);assert.equal(timers,0);
 const manifest=JSON.parse(fs.readFileSync(__dirname+'/manifest.json','utf8').replace(/^\uFEFF/,''));assert.ok(!manifest.content_scripts);assert.ok(!JSON.stringify(manifest).includes('<all_urls>'));
 console.log('PASS: privacy registry lifecycle, per-opening token reset, tab isolation, reference clearing, stale-token rejection, locked collect/fill/select/wake, and no automatic content scripts.');
})().catch(error=>{console.error(error);process.exitCode=1});
