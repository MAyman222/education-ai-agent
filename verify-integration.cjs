// Runs the production runner, worker, authorization and provider modules together.
// Chrome, page controls and model HTTP responses are test doubles, not a real browser/model.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {create}=require('./runner.js');
const event=()=>({handlers:[],addListener(f){this.handlers.push(f)}});
async function system({count=100,submit=true,wrongAt=-1}={}){
 const values={},local={model:'fixture',studyCheckV7:false},requests=[],clicks=[];
 let index=0,checks=new Set(),finished=false,url='https://quiz.test/practice',injections=0;
 const questions=Array.from({length:count},(_,i)=>({kind:i%3?'written':'choice',key:'q'+i,question:i%3?'Explain scenario '+i+': why does a loop need a termination condition?':'Question '+i+': What is 2 + 2?',options:i%3?[]:[{id:'1',text:'3'},{id:'2',text:'4'}],canFill:!!(i%3),url,entered:false}));
 const chrome={permissions:{contains:async()=>false},runtime:{onConnect:event(),onMessage:event(),getPlatformInfo:async()=>({})},
  scripting:{executeScript:async()=>{injections++;}},
  storage:{local:{get:async()=>local,remove:async()=>{}},session:{get:async key=>({[key]:values[key]}),set:async value=>Object.assign(values,value),remove:async key=>{delete values[key]}}},
  tabs:{get:async()=>({url}),onRemoved:event(),onUpdated:event(),sendMessage:async(id,message)=>{
   if(message.type==='revoke'||message.type==='authorize')return {ok:true};
   const current=questions[index];assert.equal(message.key,current.key,'Stale selection');
   assert.equal(message.type,current.kind==='choice'?'select':'fill');current.entered=true;return {selected:true};
  }}
 };
 const context=vm.createContext({chrome,crypto:require('node:crypto').webcrypto,AbortSignal,AbortController,URL,TextDecoder,Uint8Array,setInterval,clearInterval,
  fetch:async(url,options)=>{const request=JSON.parse(options.body);requests.push(request);
   const q=questions[index];return {ok:true,json:async()=>({message:{content:JSON.stringify(q.kind==='choice'?{option_id:'2',answer:'4',uncertain:false}:{option_id:'',answer:'The condition stops repetition at the required point.',uncertain:false})}})};
  }});
 context.importScripts=(...names)=>names.forEach(name=>vm.runInContext(fs.readFileSync(__dirname+'/'+name,'utf8'),context));vm.runInContext(fs.readFileSync(__dirname+'/background.js','utf8'),context);
 const send=(message,fromPage=false)=>new Promise(resolve=>chrome.runtime.onMessage.handlers[0](message,fromPage?{tab:{id:7}}:{},resolve));
 const port={name:'quiz-coach-popup',onMessage:event(),onDisconnect:event(),postMessage:reply=>port.resolve?.(reply)};chrome.runtime.onConnect.handlers[0](port);
 const portSend=message=>new Promise(resolve=>{port.resolve=resolve;port.onMessage.handlers[0](message)});
 await portSend({type:'bind',tabId:7});const {token}=await portSend({type:'allow'});
 await portSend({type:'configure',token,auto:true,submit,reference:'',lookup:false});
 const runner=create({
  access:()=>send({type:'session-status',token},true),wait:async()=>{},
  next:async()=>questions[index]&&!questions[index].entered?questions[index]:null,
  scroll:async q=>assert.equal(q.key,questions[index].key),
  answer:q=>send({type:'answer',data:q,token},true),
  controls:async()=>({check:!checks.has(index)?{}:null,next:index<count-1?{}:null,finish:index===count-1?{}:null}),
  click:async(node,kind)=>{const status=await send({type:'session-status',token},true);assert.ok(status.allowed&&status.auto);if(kind!=='next')assert.ok(status.submit);clicks.push(kind);if(kind==='check')checks.add(index);else if(kind==='next')index++;else finished=true;},
  feedback:async()=>checks.has(index)?(index===wrongAt?'incorrect':'correct'):null,changed:async q=>q.key!==questions[index].key,
  event:(phase,message,key)=>send({type:'flow-event',phase,message,key,token},true)
 });
 await runner.start();
 return {values,questions,requests,clicks,finished,token,portSend,send,port,chrome,context,get injections(){return injections},navigate:async next=>{url=next;for(const f of chrome.tabs.onUpdated.handlers)f(7,{status:'complete',url},{url});await new Promise(resolve=>setImmediate(resolve));}};
}
(async()=>{
 let s=await system();assert.equal(s.requests.length,100);assert.equal(s.values['flow-7'].history.length,100);assert.ok(s.values['flow-7'].history.every(x=>x.entered&&x.verification==='correct'));assert.equal(s.clicks.filter(x=>x==='next').length,99);assert.ok(s.finished);assert.equal(s.values['flow-7'].auto,false);
 // Explain an earlier question while preserving the latest answer and progress.
 const before=s.values['tab-7'].answerData.key;
 // Source prompt correctness is covered by unit tests; here verify wrong-history rejection.
 let reply=await s.send({type:'explain',tabId:7,token:s.token,historyKey:'missing'});assert.match(reply.error,/no longer/);assert.equal(s.values['tab-7'].answerData.key,before);
 s=await system({count:3,submit:false});assert.equal(s.requests.length,1);assert.equal(s.clicks.length,0);assert.equal(s.values['flow-7'].phase,'paused');assert.equal(s.values['flow-7'].history[0].verification,'unverified');
 // Grant submission in the same session, then test navigation continuity and privacy.
 await s.portSend({type:'configure',token:s.token,auto:true,submit:true});await s.navigate('https://quiz.test/practice/2');assert.equal(s.injections,1);assert.equal((await s.send({type:'session-status',token:s.token},true)).allowed,true);
 await s.navigate('https://other.test/private');assert.equal((await s.send({type:'session-status',token:s.token},true)).allowed,false);assert.equal(s.values['flow-7'],undefined);
 s=await system({count:5,wrongAt:1});assert.equal(s.requests.length,2);assert.equal(s.clicks.filter(x=>x==='next').length,1);assert.equal(s.values['flow-7'].history[1].verification,'incorrect');assert.equal(s.values['flow-7'].phase,'paused');
 for(const f of s.port.onDisconnect.handlers)f();await new Promise(resolve=>setImmediate(resolve));assert.equal(s.values['flow-7'],undefined);assert.equal(s.values['tab-7'],undefined);reply=await s.send({type:'answer',tabId:7,data:s.questions[2],token:s.token});assert.match(reply.error,/locked/);
 console.log('PASS: integrated production worker + runner + provider + session registry: 100 mixed MCQ/scenario/written questions, 99 Next clicks, 100 checks, finish, history, submit denied, incorrect feedback pause, same-origin reinjection, cross-origin lock, close clears history and stale requests rejected. Browser DOM and model HTTP are mocked.');
})().catch(error=>{console.error(error);process.exitCode=1});
