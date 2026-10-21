const $=id=>document.getElementById(id);
let tab,draft=null,dirty=false,state=null,models=[],operation=0,token=null,port=null,flowState=null,submitAllowed=false,historySignature="";
function lockUI(){submitAllowed=false;flowState=null;historySignature='';$('question-list').replaceChildren();$('scan-count').textContent='Allow read, then scan the page.';$('history').replaceChildren();$('history-count').textContent='(0)';for(const id of ['count-entered','count-correct','count-review'])$(id).textContent='0';$('submit').disabled=true;paintPermission();token=null;draft=null;state=null;dirty=false;$('read-controls').disabled=true;$('allow').disabled=false;$('revoke').disabled=true;$('auto').checked=false;$('lookup').checked=false;for(const id of ['question','options','reference'])$(id).value='';for(const id of ['answer','answered-question','quality','explanation','elapsed'])$(id).textContent='';$('sources').replaceChildren();status('Reading locked. Click Allow read for this opening.');paintPermission();}
function portRequest(message,expected){return new Promise((resolve,reject)=>{let timeout;const receive=reply=>{if(reply.type!==expected&&reply.type!=='error')return;clearTimeout(timeout);port.onMessage.removeListener(receive);if(reply.error)reject(Error(reply.error));else resolve(reply);};port.onMessage.addListener(receive);timeout=setTimeout(()=>{port.onMessage.removeListener(receive);reject(Error('Session connection timed out. Reopen the extension.'));},5000);port.postMessage(message);});}
function status(message){$('status').textContent=message;}
function render(data){draft=data;dirty=false;$('question').value=data.question;$('options').value=(data.options||[]).map(o=>o.text).join('\n');}
function paint(){
 if(!state)return;status(state.busy?state.status:flowState?.message||state.status);if(state.data&&!dirty)render(state.data);
 $('answer').textContent=state.answer||'';
 $('answered-question').textContent=state.answerData?.question?'Answer to: '+state.answerData.question:'';
 $('quality').textContent=state.quality||'';$('explanation').textContent=state.explanation||'';
 $('sources').replaceChildren();for(const source of state.sources||[]){if(!source.url){const note=document.createElement('li');note.textContent=source.title+' (local study notes)';$('sources').append(note);continue;}if(!source.url.startsWith('https://'))continue;const li=document.createElement('li'),a=document.createElement('a');a.href=source.url;a.textContent=source.title;a.target='_blank';a.rel='noopener noreferrer';li.append(a);$('sources').append(li);}
 $('explain').disabled=!state.answer||!!state.busy;$('test').disabled=!!state.busy;
}
function paintPermission(){
 $('submit').textContent='Allow submit: '+(submitAllowed?'ON':'OFF');$('submit').setAttribute('aria-pressed',String(submitAllowed));
 $('session-badge').textContent=token?(flowState?.auto?'Running':'Read allowed'):'Locked';$('session-badge').classList.toggle('active',!!token);
}
function paintHistory(){
 const history=flowState?.history||[];$('history-count').textContent='('+history.length+')';
 $('count-entered').textContent=history.filter(item=>item.entered).length;
 $('count-correct').textContent=history.filter(item=>item.verification==='correct').length;
 $('count-review').textContent=history.filter(item=>item.review||item.verification==='incorrect').length;
 const signature=JSON.stringify(history);if(signature===historySignature)return;historySignature=signature;
 const openKeys=new Set([...$('history').children].filter(node=>node.open).map(node=>node.dataset.key));$('history').replaceChildren();
 for(const [index,item]of [...history.entries()].reverse()){
  const details=document.createElement('details');details.dataset.key=item.key;details.open=openKeys.has(item.key);
  const summary=document.createElement('summary');summary.textContent=(index+1)+'. '+item.data.question.slice(0,100);details.append(summary);
  const answer=document.createElement('p');answer.textContent=item.answer;details.append(answer);
  const badge=document.createElement('p');badge.className='note';badge.textContent=(item.review?'Needs review':item.entered?'Entered':'Not entered')+' · Site result: '+item.verification;details.append(badge);
  const button=document.createElement('button');button.textContent='Pause & explain';button.addEventListener('click',async()=>{button.disabled=true;try{await pause();await saveSettings();const reply=await chrome.runtime.sendMessage({type:'explain',tabId:tab.id,token,historyKey:item.key});if(reply.error)throw Error(reply.error);await show();}catch(error){status(error.message)}finally{button.disabled=false}});details.append(button);
  const explanation=document.createElement('pre');explanation.textContent=item.explanation||'';details.append(explanation);$('history').append(details);
 }
}
async function show(){if(!token)return;const stored=await chrome.storage.session.get(['tab-'+tab.id,'flow-'+tab.id]);if(!token)return;state=stored['tab-'+tab.id];flowState=stored['flow-'+tab.id];if(flowState){submitAllowed=flowState.submit;$('auto').checked=flowState.auto;}paintPermission();paintHistory();paint();if(!state&&flowState?.message)status(flowState.message);}
async function pause(){operation++;if(token)await page({type:'pause'}).catch(()=>{});await cancel();if(token)await setAuto(false);}

setInterval(()=>{$('elapsed').textContent=state?.busy&&state.startedAt?'Running for '+Math.floor((Date.now()-state.startedAt)/1000)+' seconds. Stop is available.':'';},1000);
async function page(message){if(!token)throw Error('Reading locked. Click Allow read first.');return chrome.tabs.sendMessage(tab.id,{...message,token});}
async function cancel(){await chrome.runtime.sendMessage({type:'cancel',tabId:tab.id});}
async function saveSettings(){
 const selected=models.find(model=>model.key===$('model').value);if(!selected)throw Error('Choose a model from a running local server. Click Scan models first.');
 await chrome.storage.local.set({selectedModel:selected,model:selected.id,studyCheckV7:$('check').checked,reasoningMode:$('reasoning').checked});if(token)await portRequest({type:'configure',token,auto:$('auto').checked,submit:submitAllowed,reference:$('reference').value,lookup:$('lookup').checked},'configured');return selected;
}
async function setAuto(enabled){if(!token)throw Error('Click Allow read first.');$('auto').checked=enabled;await portRequest({type:'configure',token,auto:enabled,submit:submitAllowed,reference:$('reference').value,lookup:$('lookup').checked},'configured');await page({type:'wake'});}
async function read(){const result=await page({type:'collect'});if(result.error)throw Error(result.error);render(result.data);return result.data;}
async function scan(){
 $('model-status').textContent='Scanning local model servers...';const stored=await chrome.storage.local.get(['selectedModel','model']);
 const result=await chrome.runtime.sendMessage({type:'list-models'});if(result.error)throw Error(result.error);models=result.models||[];
 const chosen=models.find(m=>m.key===stored.selectedModel?.key)||models.find(m=>m.id===stored.model)||models[0];$('model').replaceChildren();
 for(const m of models){const option=document.createElement('option');option.value=m.key;option.textContent=m.label;$('model').append(option);}
 if(chosen){$('model').value=chosen.key;await chrome.storage.local.set({selectedModel:chosen,model:chosen.id});}
 else{const option=document.createElement('option');option.value='';option.textContent='No models found — start a local server';$('model').append(option);}
 $('model-status').textContent=models.length?models.length+' available model(s) detected.':'No running servers exposed models. Start Ollama, LM Studio server, or add a local endpoint.';
 $('servers').textContent=(result.providers||[]).map(p=>p.label+' ('+p.base+'): '+p.status).join('\n');
}
function action(id,fn){$(id).addEventListener('click',async()=>{const hold=!['read','solve','start'].includes(id);if(hold)$(id).disabled=true;try{await fn()}catch(error){status(error.message)}finally{if(hold)$(id).disabled=id==='allow'?!!token:id==='revoke'||id==='submit'?!token:false}})}
async function answerCurrent(forceDetect=false,startAuto=false){
 if(!token)throw Error('Click Allow read first.');const ticket=++operation;await page({type:'pause'});$('auto').checked=false;await cancel();await saveSettings();let data;
 if(forceDetect||!dirty){data=await read();}else{
 const question=$('question').value.trim();if(!question)throw Error('Detect or paste a question first.');
 const options=$('options').value.split('\n').map(text=>text.trim()).filter(Boolean).map((text,i)=>({id:String(i+1),text}));
 data={kind:options.length>=2?'choice':'text',question,options,manual:true,key:JSON.stringify([question,options]),url:tab.url};}
 if(startAuto)await setAuto(true);status('Request sent. Waiting for local model...');
 const result=await chrome.runtime.sendMessage({type:'answer',tabId:tab.id,data,token});if(ticket!==operation)return;if(result.error)throw Error(result.error);dirty=false;await show();
}
action('allow',async()=>{
 const grant=await portRequest({type:'allow'},'allowed');token=grant.token;
 try{await chrome.scripting.executeScript({target:{tabId:tab.id},files:['flow.js','runner.js','choices.js','content.js']});const reply=await page({type:'authorize'});if(reply.error)throw Error(reply.error);$('read-controls').disabled=false;$('submit').disabled=false;paintPermission();$('allow').disabled=true;$('revoke').disabled=false;status('Reading allowed for this opening. Choose Start automatically or Answer / fill.');}
 catch(error){await portRequest({type:'revoke',tabId:tab.id},'bound');lockUI();throw error;}
});
action('revoke',async()=>{operation++;await portRequest({type:'revoke',tabId:tab.id},'bound');lockUI();});
action('panel',async()=>{await chrome.windows.create({url:chrome.runtime.getURL('popup.html')+'?tab='+tab.id,type:'popup',width:510,height:900});window.close();});
async function scanQuestions(){
 const result=await page({type:'scan'});if(result.error)throw Error(result.error);
 $('question-list').replaceChildren();const found=result.questions||[];
 for(const item of found){const li=document.createElement('li');li.textContent=(item.kind==='choice'?item.options.length+' choices':'Written / scenario')+' · '+(item.answered?'Already contains an answer · ':'')+item.question;$('question-list').append(li);}
 $('scan-count').textContent=found.length+' recognised question(s) on this page · '+found.filter(item=>!item.answered).length+' unanswered'+(result.frames?' · '+result.frames+' embedded frame(s), which may contain more questions':'');
 return found;
}
action('scan-questions',scanQuestions);
action('read',()=>answerCurrent(true));action('solve',()=>answerCurrent());action('start',async()=>{await scanQuestions();await saveSettings();await setAuto(true);status('Practice running. The quiz will scroll and advance automatically.');});
action('submit',async()=>{if(!token)throw Error('Click Allow read first.');submitAllowed=!submitAllowed;paintPermission();await saveSettings();status(submitAllowed?'Submit allowed for this opening. Click Start / continue when ready.':'Submit disabled. Selecting and navigation remain available.');});
action('stop',async()=>{await pause();await show();status('Paused. Your session answers are still available.');});action('scan',scan);
action('test',async()=>{if(token)await pause();await saveSettings();status('Testing the selected local model…');const r=await chrome.runtime.sendMessage({type:'test-model',tabId:tab.id});if(r.error)throw Error(r.error);status('Connection passed: the selected model answered the test correctly.');if(token)await show();});
action('explain',async()=>{await pause();await saveSettings();const r=await chrome.runtime.sendMessage({type:'explain',tabId:tab.id,token});if(r.error)throw Error(r.error);await show();});
action('add-server',async()=>{
 const url=new URL($('server-url').value.trim());if(!['http:','https:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Enter a local server URL.');
 if(url.pathname==='/')url.pathname='/v1';const base=url.href.replace(/\/$/,'');const {customServers=[]}=await chrome.storage.local.get('customServers');if(!customServers.includes(base))customServers.push(base);
 await chrome.storage.local.set({customServers});await scan();
});
$('model').addEventListener('change',async()=>{try{operation++;await cancel();await saveSettings();status('Model selected. Click Start automatically or Answer / fill.');}catch(error){status(error.message)}});
for(const id of ['question','options'])$(id).addEventListener('input',()=>{dirty=true});
for(const id of ['check','reasoning','reference'])$(id).addEventListener('change',()=>saveSettings().catch(error=>status(error.message)));
$('lookup').addEventListener('change',async()=>{
 try{if($('lookup').checked){const granted=await chrome.permissions.request({origins:['https://en.wikipedia.org/*']});if(!granted){$('lookup').checked=false;status('Wikipedia lookup not enabled.');return;}}await saveSettings();status($('lookup').checked?'Wikipedia lookup enabled for this opening; question keywords will be sent there.':'External lookup off.');}
 catch(error){$('lookup').checked=false;status(error.message);}
});
$('auto').addEventListener('change',async()=>{try{await saveSettings();await setAuto($('auto').checked);if(!$('auto').checked)await cancel();}catch(error){$('auto').checked=false;status(error.message)}});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session'&&tab)show().catch(error=>status(error.message));});
(async()=>{
 lockUI();
 const requested=Number(new URLSearchParams(location.search).get('tab'));
 if(requested>0)tab=await chrome.tabs.get(requested);else [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 if(!tab?.id)throw Error('No active quiz tab.');
 port=chrome.runtime.connect({name:'quiz-coach-popup'});
 port.onMessage.addListener(message=>{if(message.type==='locked')lockUI();});
 port.onDisconnect.addListener(lockUI);
 await portRequest({type:'bind',tabId:tab.id},'bound');
 const {studyCheckV7=false,reasoningMode=false}=await chrome.storage.local.get(['studyCheckV7','reasoningMode']);
 $('check').checked=studyCheckV7;$('reasoning').checked=reasoningMode;
 setInterval(()=>{try{port.postMessage({type:'ping'});}catch{}},20000);
 await scan();
})().catch(error=>status(error.message));

async function notesStatus(){const {studyLibrary=[]}=await chrome.storage.local.get('studyLibrary');$('notes-status').textContent=studyLibrary.length+' saved note file(s). Foundation references are available offline.';}
$('notes-files').addEventListener('change',async()=>{
 try{if(!token)throw Error('Click Allow read first.');const {studyLibrary=[]}=await chrome.storage.local.get('studyLibrary');
 for(const file of $('notes-files').files){if(!/\.(txt|md)$/i.test(file.name))throw Error('Choose .txt or .md files.');if(file.size>400000)throw Error('Each note file must be under 400 KB.');if(studyLibrary.length>=8)throw Error('Up to eight note files are supported.');const text=await file.text();if(text.length>200000)throw Error('Each note file must have under 200,000 characters.');studyLibrary.push({id:crypto.randomUUID(),title:file.name,text});}
 await chrome.storage.local.set({studyLibrary});$('notes-files').value='';await notesStatus();status('Study notes saved locally. Relevant excerpts will support future answers.');}
 catch(error){status(error.message);}
});
action('clear-notes',async()=>{await chrome.storage.local.remove('studyLibrary');await notesStatus();status('Saved study notes removed.');});
notesStatus().catch(()=>{});
