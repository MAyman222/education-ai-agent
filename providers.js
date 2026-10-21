/* Local inference server discovery and streaming adapters. No cloud destinations. */
(function(root) {
  const cpuFallbacks=new Set();
  function baseUrl(value) {
    const url = new URL(value);
    if (!['http:','https:'].includes(url.protocol) || !['localhost','127.0.0.1','[::1]'].includes(url.hostname) || url.username || url.password) throw Error('Use a local server URL (localhost or 127.0.0.1).');
    return url.href.replace(/\/$/,'');
  }
  function entry(kind,base,id,label) {
    if (/(?:[:\-]cloud)(?::|$)/i.test(id)) throw Error('Cloud-tagged models are disabled for private page reading. Choose a local model.');
    return {kind,base:baseUrl(base),id,label:label || id,key:JSON.stringify([kind,baseUrl(base),id])};
  }
  async function discover(extra = []) {
    const endpoints = [
      {kind:'ollama',base:'http://localhost:11434',label:'Ollama'},
      {kind:'openai',base:'http://localhost:1234/v1',label:'LM Studio / port 1234'},
      {kind:'openai',base:'http://localhost:8080/v1',label:'Local server / port 8080'},
      {kind:'openai',base:'http://localhost:8000/v1',label:'Local server / port 8000'},
      ...extra.map(base=>({kind:'openai',base:baseUrl(base),label:'Custom local server'}))
    ];
    const unique = endpoints.filter((e,i,a)=>a.findIndex(x=>x.kind===e.kind&&x.base===e.base)===i);
    const providers = await Promise.all(unique.map(async endpoint=>{
      try {
        const response = await fetch(endpoint.base+(endpoint.kind==='ollama'?'/api/tags':'/models'),{signal:AbortSignal.timeout(3500)});
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        const body=await response.json();
        const list=endpoint.kind==='ollama'?body.models:body.data;
        if(!Array.isArray(list)) throw Error('No models list returned');
        const models=list.map(item=>item.name||item.id||item.model).filter(id=>typeof id==='string'&&id&&!/(?:[:\-]cloud)(?::|$)/i.test(id)).map(id=>entry(endpoint.kind,endpoint.base,id,id+' — '+endpoint.label));
        return {...endpoint,models,status:models.length?'available':'No models exposed by server'};
      } catch(error) {return {...endpoint,models:[],status:error.name==='TimeoutError'?'Not responding':error.message};}
    }));
    return {models:providers.flatMap(p=>p.models),providers:providers.map(({models,...p})=>p)};
  }
  async function generate(client,prompt,schema,{signal,onProgress=async()=>{},reasoning=false}={}) {
    if (/(?:[:\-]cloud)(?::|$)/i.test(client.id)) throw Error('Cloud-tagged models are disabled for private page reading.');
    const base=baseUrl(client.base), ollama=client.kind==='ollama';
    const messages=[{role:'system',content:'You are an academic study assistant. Return only the requested JSON. Distinguish knowledge from evidence and acknowledge uncertainty.'},{role:'user',content:prompt+'\nReturn one JSON object matching this schema:\n'+JSON.stringify(schema)}];
    const body=ollama?{model:client.id,messages,stream:true,format:schema,think:reasoning,keep_alive:'10m',options:{temperature:0,num_predict:1600}}:
      {model:client.id,messages,stream:true,temperature:0,max_tokens:1600};
    const runtimeKey=base+'|'+client.id;
    if(ollama&&(client.cpuOnly||cpuFallbacks.has(runtimeKey))){body.options.num_gpu=0;await onProgress('Using CPU recovery for this model (slower).');}
    const url=base+(ollama?'/api/chat':'/chat/completions');
    const request=()=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify(body)});
    let response=await request();
    if(!response.ok&&response.status===400&&ollama){const detail=await response.text();if(/think/i.test(detail)){delete body.think;response=await request();}else throw Error('Server rejected the request: '+detail.slice(0,250));}
    if(!response.ok){
      const detail=await response.text();
      if(ollama&&response.status>=500&&/CUDA|shared object initialization|0xc0000409/i.test(detail)&&body.options.num_gpu!==0){
        cpuFallbacks.add(runtimeKey);body.options.num_gpu=0;
        await onProgress('The GPU runner crashed. Retrying this request on CPU (slower).');response=await request();
      }else throw Error(`Local server HTTP ${response.status}: ${detail.slice(0,350)}`);
    }
    if(!response.ok)throw Error(`CPU recovery failed, HTTP ${response.status}: ${(await response.text()).slice(0,350)}`);
    await onProgress('Connected; waiting for answer...');
    let text='',done=false,buffer='',lastUpdate=0,thinking=false;
    async function consume(line) {
      line=line.trim();if(!line||line.startsWith(':')||line.startsWith('event:'))return;
      if(!ollama){if(!line.startsWith('data:'))return;line=line.slice(5).trim();if(line==='[DONE]'){done=true;return;}}
      const part=JSON.parse(line);if(part.error)throw Error(typeof part.error==='string'?part.error:part.error.message||'Generation failed');
      text+=ollama?(part.message?.content||part.response||''):(part.choices?.[0]?.delta?.content||part.choices?.[0]?.message?.content||'');
      thinking=thinking||!!part.message?.thinking||!!part.choices?.[0]?.delta?.reasoning_content;
      if(part.done||part.choices?.[0]?.finish_reason)done=true;
      if(Date.now()-lastUpdate>1500){lastUpdate=Date.now();await onProgress(text?'Receiving answer ('+text.length+' characters)...':thinking?'Model is reasoning; waiting for final answer...':'Loading / generating...');}
    }
    if(response.body?.getReader){
      const reader=response.body.getReader(),decoder=new TextDecoder();
      for(;;){const chunk=await reader.read();buffer+=decoder.decode(chunk.value||new Uint8Array(),{stream:!chunk.done});const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines)await consume(line);if(chunk.done){if(buffer.trim())await consume(buffer);break;}}
    }else{const part=await response.json();text=part.message?.content||part.response||part.choices?.[0]?.message?.content||'';done=true;}
    if(!done)throw Error('The model stream ended before completion. Retry.');
    if(!text.trim())throw Error('The model returned no final answer. Turn off reasoning or choose another model.');
    text=text.replace(/<think>[\s\S]*?<\/think>/g,'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    try{return JSON.parse(text);}catch{const start=text.indexOf('{'),end=text.lastIndexOf('}');if(start>=0&&end>start){try{return JSON.parse(text.slice(start,end+1));}catch{}}throw Error('Model did not return usable JSON: '+text.slice(0,180));}
  }
  const api={baseUrl,entry,discover,generate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LocalModels=api;
})(globalThis);
