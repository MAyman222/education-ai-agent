const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const code = fs.readFileSync(__dirname+'/background.js','utf8');
async function test(response, config={}) {
 const {auto=false,enabled=true,selection={selected:true},written=false,manual=false,stream=false,malformed=false,second,reference=''}=config;
 const values={model:'test',studyCheckV7:config.check??true,studyReference:reference,enabledSites:{'https://quiz.test':enabled}};
 let listener,calls=[],requests=[];
 const chrome={storage:{local:{get:async()=>values,remove:async()=>{}},session:{get:async k=>({[k]:values[k]}),set:async v=>Object.assign(values,v),remove:async()=>{}}},tabs:{sendMessage:async(id,m)=>{calls.push(m);return selection},onRemoved:{addListener:()=>{}},onUpdated:{addListener:()=>{}}},runtime:{onConnect:{addListener:()=>{}},getPlatformInfo:async()=>({}),onMessage:{addListener:f=>listener=f}}};
 const fetch=async(url,options)=>{
  assert.ok(url.endsWith('/api/chat'));
  requests.push(JSON.parse(options.body));
  const body=requests.length===2&&second?second:response;
  const text=malformed?'not json':JSON.stringify(body);
  if(!stream)return {ok:true,json:async()=>({message:{content:text}})};
  const chunks=[JSON.stringify({message:{thinking:'private model thoughts',content:''},done:false})+'\n',JSON.stringify({message:{content:text.slice(0,8)},done:false})+'\n',JSON.stringify({message:{content:text.slice(8)},done:true})+'\n'];
  return {ok:true,body:new ReadableStream({start(c){const all=chunks.join('');for(let i=0;i<all.length;i+=9)c.enqueue(new TextEncoder().encode(all.slice(i,i+9)));c.close()}})};
 };
 const context=vm.createContext({chrome,fetch,AbortSignal,AbortController,crypto:require('node:crypto').webcrypto,URL,Set,Map,Error,TypeError,JSON,Number,Array,String,Uint8Array,TextDecoder,setInterval,clearInterval});context.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8'),context));vm.runInContext(code,context);const lease=await vm.runInContext('readSessions.open(7)',context);const token=vm.runInContext('readSessions.allow(readSessions.get(7))',context);lease.reference=reference;lease.auto=enabled;
 const data={kind:written?'written':'choice',key:'q1',url:'https://quiz.test/practice',question:written?'Explain why a loop needs a termination condition.':'What is 2+2?',options:written?[]:[{id:'1',text:'3'},{id:'2',text:'4'}],canFill:written,manual};
 const result=await new Promise(resolve=>listener({type:'answer',tabId:7,data,token},auto?{tab:{id:7}}:{},resolve));
 return {result,calls,requests,state:values['tab-7']};
}
(async()=>{
 const answer={option_id:'2',answer:'4',uncertain:false};
 let r=await test(answer);assert.equal(r.calls.length,1);assert.equal(r.state.answer,'4');assert.equal(r.requests.length,2);
 r=await test({...answer,option_id:'99',answer:'invented'});assert.equal(r.calls.length,0);assert.match(r.state.status,/source/);
 r=await test({...answer,uncertain:true});assert.equal(r.calls.length,0);assert.match(r.state.status,/source/);
 r=await test({option_id:'2'});assert.equal(r.calls.length,0);
 r=await test(answer,{auto:true,enabled:false});assert.equal(r.calls.length,0);
 r=await test(answer,{selection:{error:'Question changed'}});assert.equal(r.state.answer,'4');assert.match(r.state.status,/not entered/);
 r=await test({option_id:'',answer:'It stops repetition when the condition is met.',uncertain:false},{written:true});assert.equal(r.calls[0].type,'fill');
 r=await test({option_id:'',answer:'A scenario answer.',uncertain:false},{written:true,manual:true});assert.equal(r.calls.length,0);assert.equal(r.state.status,'Answer ready');
 r=await test(answer,{stream:true});assert.equal(r.state.answer,'4');
 r=await test(answer,{malformed:true});assert.equal(r.calls.length,0);assert.match(r.result.error,/usable JSON/);
 r=await test(answer,{second:{option_id:'1',answer:'3',uncertain:false}});assert.equal(r.calls.length,0);assert.match(r.state.status,/disagree/);
 r=await test({...answer,answer:'3'});assert.equal(r.calls.length,0);assert.match(r.state.status,/disagree/);
 r=await test(answer,{reference:'Reference: two plus two equals four.'});assert.ok(r.requests.every(request=>request.messages[1].content.includes('Reference: two plus two equals four.')));assert.match(r.state.quality,/supplied reference/);
 r=await test(answer,{check:false});assert.equal(r.requests.length,1);assert.equal(r.calls.length,1);
 r=await test(answer);const first=JSON.parse(r.requests[0].messages[1].content.split('\nReturn one JSON')[0].split('\n').slice(1).join('\n'));const second=JSON.parse(r.requests[1].messages[1].content.split('\nReturn one JSON')[0].split('\n').slice(1).join('\n'));assert.equal(first.options[0].id,'1');assert.equal(second.options[0].id,'2');assert.ok(!('answer' in second));
 console.log('PASS: 15 background checks, including chat streaming, abstention, ID/text consistency, independent-pass disagreement, references and reversed choices. These are workflow checks, not a model accuracy benchmark.');
})().catch(e=>{console.error(e);process.exitCode=1});

