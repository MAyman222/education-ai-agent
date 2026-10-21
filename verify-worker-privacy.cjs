const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto').webcrypto;
function event(){const handlers=[];return {addListener:f=>handlers.push(f),handlers};}
(async()=>{
 const values={},local={model:'test'},onConnect=event(),onMessage=event();let fetches=0,cleared;
 const chrome={permissions:{contains:async()=>false},runtime:{onConnect,onMessage,getPlatformInfo:async()=>({})},
 storage:{local:{get:async()=>local,remove:async keys=>keys.forEach(key=>delete local[key])},session:{get:async key=>({[key]:values[key]}),set:async data=>Object.assign(values,data),remove:async key=>{delete values[key];if(cleared)cleared();}}},
 tabs:{sendMessage:async()=>({selected:true}),onRemoved:event(),onUpdated:event()}};
 const context=vm.createContext({chrome,crypto,AbortSignal,AbortController,URL,TextDecoder,Uint8Array,Date,Map,Set,Error,JSON,Number,Array,String,Promise,setInterval,clearInterval,
 fetch:async()=>{fetches++;return {ok:true,json:async()=>({message:{content:'{"option_id":"2","answer":"4","uncertain":false}'}})}}});
 context.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8'),context));vm.runInContext(fs.readFileSync(__dirname+'/background.js','utf8'),context);
 function message(data){return new Promise(resolve=>onMessage.handlers[0](data,{},resolve));}
 const data={question:'What is 2 + 2?',options:[{id:'1',text:'3'},{id:'2',text:'4'}],key:'private-question',url:'https://quiz.test',kind:'choice'};
 let r=await message({type:'answer',tabId:7,data});assert.match(r.error,/locked/);assert.equal(fetches,0);
 const port={name:'quiz-coach-popup',onMessage:event(),onDisconnect:event(),postMessage:reply=>{port.reply=reply;if(port.resolve)port.resolve(reply);}};onConnect.handlers[0](port);
 async function portMessage(value){return new Promise(resolve=>{port.resolve=resolve;port.onMessage.handlers[0](value);});}
 await portMessage({type:'bind',tabId:7});r=await portMessage({type:'allow'});const token=r.token;assert.ok(token);
 r=await portMessage({type:'configure',token,auto:true,reference:'Private reference',lookup:true});assert.match(r.error,/permission/);assert.equal(fetches,0);
 await portMessage({type:'configure',token,auto:true,reference:'Private reference',lookup:false});
 r=await message({type:'answer',tabId:7,data,token});assert.ok(r.ok);assert.equal(fetches,1);assert.equal(values['tab-7'].answer,'4');assert.ok(!('studyReference' in local));
 const removed=new Promise(resolve=>{cleared=resolve;});port.onDisconnect.handlers[0]();await removed;assert.equal(values['tab-7'],undefined);
 r=await message({type:'answer',tabId:7,data,token});assert.match(r.error,/locked/);assert.equal(fetches,1);
 console.log('PASS: actual worker rejects pre-consent inference, optional lookup needs separate permission, reference stays out of local settings, popup disconnect clears capture, stale grant cannot infer.');
})().catch(error=>{console.error(error);process.exitCode=1});
