const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const providerCode=fs.readFileSync(__dirname+'/providers.js','utf8');
function runtime(fetch){const ctx=vm.createContext({fetch,AbortSignal,AbortController,URL,TextDecoder,Uint8Array,Date,Error,JSON,Number,String,Array,Set,Map,Promise});vm.runInContext(providerCode,ctx);return ctx.LocalModels;}
(async()=>{
 let api=runtime(async url=>({ok:true,json:async()=>url.endsWith('/api/tags')?{models:[{name:'llama3.2:latest'},{name:'qwen3.5:9b'}]}:url.includes(':1234')?{data:[{id:'local-phi'},{id:'local-gemma'}]}:{data:[]}}));
 const detected=await api.discover();assert.equal(detected.models.length,4);assert.equal(detected.models[2].kind,'openai');
 assert.throws(()=>api.baseUrl('https://example.com/v1'),/local/);assert.throws(()=>api.baseUrl('http://localhost.evil.test/v1'),/local/);assert.throws(()=>api.baseUrl('http://user:password@localhost:1234/v1'),/local/);
 let request;
 api=runtime(async(url,args)=>{request={url,body:JSON.parse(args.body)};const wire='data: '+JSON.stringify({choices:[{delta:{content:'{"answer":"4"}'},finish_reason:null}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n';return {ok:true,body:new ReadableStream({start(c){for(let i=0;i<wire.length;i+=7)c.enqueue(new TextEncoder().encode(wire.slice(i,i+7)));c.close();}})};});
 let result=await api.generate(api.entry('openai','http://localhost:1234/v1','local-phi'),'What is two plus two?',{type:'object'},{signal:AbortSignal.timeout(1000)});
 assert.equal(result.answer,'4');assert.ok(request.url.endsWith('/v1/chat/completions'));assert.equal(request.body.model,'local-phi');assert.ok(!('format' in request.body));
 api=runtime(async(url,args)=>{request=JSON.parse(args.body);return {ok:true,json:async()=>({message:{content:'{"answer":"4"}'}})};});
 result=await api.generate(api.entry('ollama','http://localhost:11434','qwen3.5:9b'),'2+2',{},{});assert.equal(request.think,false);assert.equal(result.answer,'4');
 let aborted=false;api=runtime((url,args)=>new Promise((resolve,reject)=>args.signal.addEventListener('abort',()=>{aborted=true;reject(Error('cancelled'))})));
 const controller=new AbortController();const task=api.generate(api.entry('ollama','http://localhost:11434','qwen3.5:9b'),'question',{}, {signal:controller.signal});controller.abort();await assert.rejects(task,/cancelled/);assert.ok(aborted);
 api=runtime(async()=>({ok:false,status:403,text:async()=> 'origin rejected'}));await assert.rejects(api.generate(api.entry('ollama','http://localhost:11434','qwen'),'test',{}),/403/);
 const attempts=[],progress=[];api=runtime(async(url,args)=>{const body=JSON.parse(args.body);attempts.push(body);return attempts.length===1?{ok:false,status:500,text:async()=> 'CUDA error: shared object initialization failed'}:{ok:true,json:async()=>({message:{content:'{"answer":"4"}'}})};});
 const client=api.entry('ollama','http://localhost:11434','qwen');await api.generate(client,'test',{}, {onProgress:async message=>progress.push(message)});await api.generate(client,'next',{});
 assert.equal(attempts.length,3);assert.equal(attempts[0].options.num_gpu,undefined);assert.equal(attempts[1].options.num_gpu,0);assert.equal(attempts[2].options.num_gpu,0);assert.ok(progress.some(x=>x.includes('GPU runner crashed')));
 let failures=0;api=runtime(async()=>{failures++;return {ok:false,status:500,text:async()=> 'CUDA failure'};});await assert.rejects(api.generate(client,'test',{}),/CPU recovery failed/);assert.equal(failures,2);
 console.log('PASS: local discovery across two runtimes, arbitrary model IDs, local-only URLs, fragmented OpenAI SSE, Ollama chat, reasoning off, cancellation and visible HTTP errors.');
})().catch(e=>{console.error(e);process.exitCode=1});
