(() => {
  const VERSION = '0.11.0';
  if (globalThis.__quizCoachVersion === VERSION) return;
  // Refresh the page after updating the extension, so an old listener is removed.
  globalThis.__quizCoachVersion = VERSION;
  const clean = value => (value || '').replace(/\s+/g, ' ').trim();
  const RADIO = 'input[type="radio"], [role="radio"]';
  const FIELD = 'textarea, input:not([type]), input[type="text"], input[type="number"], [contenteditable]:not([contenteditable="false"]), [role="textbox"]';
  const BLOCK = 'fieldset, [role="radiogroup"], [data-question], .question, .quiz-question, .question-container, .que, [class*="QuizQuestion"], [class*="quiz-question"], [class*="quiz__question"]';
  const ignored = 'script,style,nav,header,footer,[hidden],[aria-hidden="true"],[data-quiz-coach],.feedback,.answer-feedback,.quiz-feedback,[role="status"],[role="alert"],.CodeMirror-measure,.CodeMirror-gutters,.CodeMirror-gutter-wrapper,.CodeMirror-cursors,[cm-not-content]';
  const attempted = new Set();
  const completed = new Set();
  const flow = globalThis.QuizCoachFlow;
  let lastItem=null;const usedControls=new WeakMap();
  let busy = false, timer, detecting = false, lastDetection = '', permissionToken = null;
  function lockReader(){runner?.stop();permissionToken=null;clearTimeout(timer);attempted.clear();completed.clear();lastDetection='';}
  function requireRead(token = permissionToken) {
    if (!permissionToken || token !== permissionToken) throw Error('Reading is locked. Click Allow read in the extension.');
  }
  async function access() {
    if (!permissionToken) return {allowed:false,auto:false};
    const result=await chrome.runtime.sendMessage({type:'session-status',token:permissionToken});
    if(!result?.allowed)lockReader();
    return result || {allowed:false,auto:false};
  }

  function visible(element) {
    if (!element || element.closest('[hidden],[aria-hidden="true"]')) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  }
  function onScreen(root) {
    const r = root.getBoundingClientRect();
    return visible(root) && r.bottom > 0 && r.top < innerHeight;
  }
  function associated(element) {
    const ids = (element.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
    return [...(element.labels || []), ...ids.map(id => document.getElementById(id)).filter(Boolean)];
  }
  function optionLabel(element) {
    const nodes = associated(element);
    let text = clean(nodes.map(n => n.innerText || n.textContent).join(' ') || element.getAttribute('aria-label') || element.innerText);
    if (!text) {
      const row = element.closest('li, [class*="answer"], [class*="option"]') || element.parentElement;
      if (row && row.querySelectorAll(RADIO).length === 1) text = clean(row.innerText);
    }
    return text;
  }
  function displayNode(element) {
    const row = element.matches('input') ? element.closest('li,[class*="answer"],[class*="option"]') : null;
    return associated(element).find(visible) || element.closest('label') || row || element;
  }
  function commonAncestor(elements) {
    let node = elements[0];
    while (node && !elements.every(e => node.contains(e))) node = node.parentElement;
    return node;
  }
  function textWithout(root, exclusions = []) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const parts = [];
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || parent.closest(ignored + ',button,input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')) continue;
      if (exclusions.some(e => e === parent || e.contains(parent))) continue;
      if (!visible(parent)) continue;
      const text = clean(node.textContent);
      if (text) parts.push(text);
    }
    return clean(parts.join(' '));
  }
  function makeCandidate(kind, root, question, options = [], controls = [], field = null) {
    if (!visible(root) || question.length < 8 || question.length > 12000) return null;
    const rect = root.getBoundingClientRect();
    const key = JSON.stringify([location.href, kind, question, options]);
    return { kind, root, question, options, controls, field, key, url: location.href,
      score: Math.abs(rect.top - innerHeight * .23) };
  }
  function radioCandidates() {
    const elements = [...document.querySelectorAll(RADIO)].filter(e => !e.disabled && e.getAttribute('aria-disabled') !== 'true' && visible(displayNode(e)));
    const groups = [];
    for (const element of elements) {
      const container = element.closest('[role="radiogroup"], fieldset') || element.closest('ul,ol') || element.parentElement?.parentElement;
      let group = groups.find(g => element.name ? g.name === element.name && g.form === element.form : g.container === container);
      if (!group) { group = { name: element.name, form: element.form, container, controls: [] }; groups.push(group); }
      group.controls.push(element);
    }
    return groups.flatMap(group => {
      if (group.controls.length < 2 || group.controls.length > 20) return [];
      const options = group.controls.map((e, i) => ({ id: String(i + 1), text: optionLabel(e) }));
      if (options.some(o => !o.text) || new Set(options.map(o => o.text)).size !== options.length) return [];
      const excluded = group.controls.flatMap(e => {
        const labels = associated(e);
        const row = e.closest('li,[class*="answer"],[class*="option"]');
        return [...labels, ...(row && row.querySelectorAll(RADIO).length === 1 ? [row] : []), ...(e.matches('[role="radio"]') ? [e] : [])];
      });
      let root = commonAncestor(group.controls.map(displayNode));
      for (let depth = 0; root && root !== document.body && depth < 7; depth++, root = root.parentElement) {
        // Never expand into a second question's control group.
        if ([...root.querySelectorAll(RADIO)].some(e => elements.includes(e) && !group.controls.includes(e))) break;
        const question = textWithout(root, excluded);
        if (question.length >= 8) {
          const candidate = makeCandidate('choice', root, question, options, group.controls);
          return candidate ? [candidate] : [];
        }
      }
      return [];
    });
  }
  function fieldCandidates() {
    return [...document.querySelectorAll(FIELD)].flatMap(field => {
      if (!visible(field) || field.disabled || field.readOnly || field.closest('nav,header,footer,[role="search"]')) return [];
      if (/search|email|password|username|login|subscribe/i.test([field.name, field.id, field.getAttribute('placeholder')].join(' '))) return [];
      let root = field.closest(BLOCK) || field.parentElement;
      for (let depth = 0; root && root !== document.body && depth < 12; depth++, root = root.parentElement) {
        if (root.querySelector(RADIO) || root.querySelectorAll(FIELD).length > 1) break;
        const question = textWithout(root);
        if (question.length >= 12 && (/\?|\b(explain|describe|calculate|identify|discuss|state|give|write|what|which|how|why|scenario|case)\b/i.test(question))) {
          const candidate = makeCandidate('written', root, question, [], [], field);
          return candidate ? [candidate] : [];
        }
      }
      return [];
    });
  }
  function textCandidates() {
    return [...document.querySelectorAll(BLOCK)].flatMap(root => {
      if (root.querySelector(RADIO + ',' + FIELD) || !visible(root)) return [];
      const question = textWithout(root);
      if (!/\?|\b(explain|describe|calculate|discuss|identify|scenario|case)\b/i.test(question)) return [];
      const candidate = makeCandidate('text', root, question);
      return candidate ? [candidate] : [];
    });
  }
  function candidates(all = false) {
    requireRead();
    const writable=[...document.querySelectorAll(FIELD)].filter(node=>visible(node)&&!node.readOnly&&!node.disabled&&!node.closest('.CodeMirror,.monaco-editor,[data-code-sample]'));
    const actionable=[...radioCandidates(),...QuizCoachChoices.detect(document,{visible,textWithout,makeCandidate,navigation:QuizCoachRunner.classify,radio:RADIO,field:FIELD,ignored,style:getComputedStyle,hasField:node=>writable.some(field=>node===field||node.contains(field))}),...fieldCandidates()];
    const text=textCandidates().filter(item=>!actionable.some(other=>item.root.contains(other.root)||other.root.contains(item.root)));
    return [...actionable,...text].filter(candidate=>candidate&&(all||onScreen(candidate.root))).sort((a,b) => a.score-b.score);
  }
  function publicData(candidate) {
    const { kind, question, options, key, url, field } = candidate;
    const provided=[...candidate.root.querySelectorAll('p,div,span')].filter(node=>visible(node)&&node.children.length===0).map(node=>clean(node.textContent)).find(text=>/^(?:expected|correct) answer\s*:\s*\S/i.test(text));
    return { kind, question, options, key, url, canFill: !!field, pageReference:provided?.slice(0,2000)||'' };
  }
  function capture() {
    requireRead();
    const selected = clean(window.getSelection()?.toString());
    const all = candidates(true);
    const candidate = flow.next(all, completed);
    // A leftover text selection must not override a detectable MCQ.
    if (!candidate && selected.length > 15 && !all.length) return { kind:'text', question:selected.slice(0,12000), options:[], key:JSON.stringify([location.href,selected]), url:location.href, canFill:false };
    if (!candidate) throw Error(all.length ? 'All currently recognised questions already contain answers. Use Scan all questions to inspect detection; this does not confirm the whole quiz is finished.' : 'Question not detected. Highlight the question/scenario or paste it into the popup.');
    if(!onScreen(candidate.root))candidate.root.scrollIntoView({block:'center',behavior:'instant'});
    return publicData(candidate);
  }
  async function applyAnswer(message) {
    requireRead(message.token);
    const matches = candidates().filter(candidate => candidate.key === message.key);
    if (matches.length !== 1) throw Error('Question changed or is ambiguous. Nothing was entered.');
    const current = matches[0];lastItem=current;
    if (current.kind === 'choice') {
      const index = current.options.findIndex(option => option.id === message.id);
      const control = current.controls[index];
      if (!control || !control.isConnected || control.disabled) throw Error('Option is no longer available.');
      const wasSelected=flow.selected(control);
      if (!wasSelected) {
        const target = displayNode(control);
        target.click();
        if (!flow.selected(control) && target !== control) control.click();
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      requireRead(message.token);
      const fresh = candidates().find(candidate => candidate.key === message.key);
      current.chosen=control;
      const confirmed = flow.selected(control) || (fresh && flow.selected(fresh.controls[index])) || (control.disabled&&current.controls.every(node=>node.disabled));
      if (!confirmed) throw Error('The answer tile was clicked, but the website did not expose a selected state. Check the page; it has not been counted as answered.');
      completed.add(current.key);
      if (control.isConnected) displayNode(control).style.outline = '3px solid #218858';
      schedule();
      return { selected:true };
    }
    const field = current.field;
    if (!field || !visible(field) || field.disabled || field.readOnly) throw Error('No writable answer box found. The answer is available in the popup.');
    if (clean(flow.fieldValue(field))) throw Error('The answer box already has text. It was not overwritten.');
    if (field.isContentEditable) field.textContent = message.answer;
    else {
      const prototype = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, message.answer);
    }
    field.dispatchEvent(new Event('input', {bubbles:true}));
    field.dispatchEvent(new Event('change', {bubbles:true}));
    if ((field.isContentEditable ? field.textContent : field.value) !== message.answer) throw Error('Page rejected the written answer.');
    field.style.outline = '3px solid #218858';
    completed.add(current.key);
    schedule();
    return { selected:true, written:true };
  }
  function quizControls(item){
    requireRead();
    const all=candidates(true);
    const anchor=item||lastItem||all.find(candidate=>flow.answered(candidate,completed));
    if(!anchor||!flow.answered(anchor,completed))return {};lastItem=anchor;
    // Search each action separately: an in-question Next must not hide a footer Submit.
    // Footer/nav are valid places for quiz controls, unlike question text extraction.
    const selector='button,input[type="submit"],input[type="button"],input[type="image"],[role="button"],a[href],[onclick],[tabindex="0"]';
    const excluded='script,style,header,[hidden],[aria-hidden="true"],[data-quiz-coach]';
    const labels=node=>[
      node.getAttribute('aria-label'),node.getAttribute('title'),node.innerText,node.value,
      node.getAttribute('alt'),node.getAttribute('rel')==='next'?'next':null,
      ...associated(node).map(child=>child.innerText||child.textContent),
      ...[...node.querySelectorAll('svg title,img[alt]')].map(child=>child.textContent||child.getAttribute('alt'))
    ].map(clean).filter(Boolean);
    const kindFor=node=>labels(node).map(QuizCoachRunner.classify).find(Boolean);
    const eligible=node=>visible(node)&&!node.disabled&&!node.matches(':disabled')&&node.getAttribute('aria-disabled')!=='true'&&usedControls.get(node)!==anchor.key&&!node.closest(excluded)&&!node.hasAttribute('target')&&!all.some(question=>question.controls.some(control=>control===node||control.contains(node)||node.contains(control)))&&!anchor.controls.some(control=>control===node||control.contains(node)||node.contains(control));
    const result={};
    let scope=anchor.root,depth=0;
    const matches={check:[],next:[],finish:[]};
    while(scope){
      const available=[...scope.querySelectorAll(selector)].filter(eligible);
      for(const kind of ['check','next','finish']){
        if(matches[kind].length)continue;
        matches[kind]=available.filter(node=>{
          if(kindFor(node)!==kind)return false;
          if((kind==='check'||kind==='finish')&&!anchor.root.contains(node)&&all.some(question=>!flow.answered(question,completed)))return false;
          if(node.matches('a')&&new URL(node.href,location.href).origin!==location.origin)return false;
          // Don't steal another question's local controls, or site-wide navigation.
          if(all.some(question=>question.key!==anchor.key&&question.root.contains(node)&&!question.root.contains(anchor.root)))return false;
          if((node.closest('nav,footer,[role="navigation"]'))&&scope===document.body){
            const form=node.form||node.closest('form');
            if(!(form?.contains(anchor.root)||form&&anchor.controls.some(control=>control.form===form)||node.closest('main,[data-quiz],.quiz,#quizcontainer')))return false;
          }
          return true;
        });
      }
      if(scope===document.body||depth++>=12)break;
      scope=scope.parentElement;
    }
    for(const kind of ['check','next','finish']){
      let nodes=matches[kind];
      // A nested span/role button is one control, not an ambiguity.
      nodes=nodes.filter(node=>!nodes.some(other=>other!==node&&other.contains(node)));
      if(nodes.length>1){
        const explicit=nodes.filter(node=>labels(node).some(text=>/^(next question|submit answer|check answer|mark answer|finish quiz)$/i.test(text)));
        if(explicit.length===1)nodes=explicit;
      }
      if(nodes.length>1)result.ambiguous=true;
      else if(nodes.length)result[kind]=nodes[0];
    }
    return result;
  }
  const runner=QuizCoachRunner.create({
    access,
    next:async()=>{requireRead();return flow.next(candidates(true),completed,attempted,true);},
    scroll:async item=>{requireRead();lastItem=item;item.root.scrollIntoView({block:'center',behavior:'instant'});},
    wait:ms=>new Promise(resolve=>setTimeout(resolve,ms)),
    answer:async item=>{
      requireRead();attempted.add(item.key);lastItem=item;busy=true;
      try{const result=await chrome.runtime.sendMessage({type:'answer',data:publicData(item),token:permissionToken});if(lastItem?.key===item.key)item.chosen=lastItem.chosen;return result;}
      finally{busy=false;}
    },
    summary:async()=>{
      requireRead();const all=candidates(true),entered=all.filter(item=>completed.has(item.key)).length;
      const counters=[...document.querySelectorAll('legend,h1,h2,h3,h4,span,p')].map(node=>clean(node.textContent)).filter(text=>text.length<80).map(text=>text.match(/^(?:question\s+)?(\d+)\s*(?:\/|of)\s*(\d+)(?:\s*[—–:-]|$)/i)).filter(Boolean);
      const total=Math.max(0,...counters.map(match=>Number(match[2])));
      const complete=all.length>0&&all.every(item=>completed.has(item.key))&&(!total||entered>=total);
      return {complete,message:all.length?'There may be more questions or unsupported controls. Only '+entered+' recognised questions were entered; the quiz has not been declared finished.':'No selectable MCQ or answer field detected. This page may use custom controls, an embedded frame, or a read-only quiz preview. It has not been declared finished.'};
    },
    controls:async item=>quizControls(item),
    click:async(node,kind)=>{
      const allowed=await access();requireRead();
      if(!allowed.auto||((kind==='check'||kind==='finish')&&!allowed.submit))throw Error('Action permission was revoked.');
      if(node.form&&node.type==='submit'&&!allowed.submit)throw Error('This Next control also submits the form. Allow submit, then continue.');
      if(!node.isConnected||!visible(node)||node.disabled||node.matches(':disabled')||node.getAttribute('aria-disabled')==='true'||usedControls.get(node)===lastItem?.key)throw Error('Quiz control changed. Continue on the page.');
      node.scrollIntoView({block:'center',behavior:'instant'});
      // Allow validation-blocked submits to be retried after the user fixes the form.
      if(node.form&&node.type==='submit'&&!node.form.checkValidity())throw Error('The website requires another field before submitting. Complete it, then continue.');
      usedControls.set(node,lastItem?.key);node.click();
    },
    feedback:async item=>{
      requireRead();const root=(item||lastItem)?.root;if(!root?.isConnected)return null;
      const chosen=(item||lastItem)?.chosen;
      // Public JavaScriptQuiz exposes its immediate result through these visible CSS states.
      if(location.hostname==='javascriptquiz.com'&&chosen?.disabled){
        if(chosen.classList.contains('bg-[#b91c1c]'))return 'incorrect';
        if(chosen.classList.contains('bg-[#15803d]'))return 'correct';
      }
      const nodes=[...root.querySelectorAll('[role="status"],[role="alert"],.feedback,.answer-feedback,.quiz-feedback,[data-correct]')].filter(visible);
      const text=clean(nodes.map(node=>node.innerText||node.textContent).join(' '));
      if(/\b(incorrect|wrong answer|not correct)\b/i.test(text))return 'incorrect';
      if(/^(correct[!.:]?|well done[!.:]?|right answer[!.:]?)(\s|$)/i.test(text))return 'correct';
      return null;
    },
    changed:async item=>{requireRead();return !candidates(true).some(candidate=>candidate.key===item.key);},
    event:async(phase,message,key)=>{
      if(!permissionToken)return;
      await chrome.runtime.sendMessage({type:'flow-event',token:permissionToken,phase,message,key});
    }
  });
  async function auto(){
    if(!permissionToken||document.hidden||runner.running)return;
    const allowed=await access();if(allowed.allowed&&allowed.auto){await runner.start();if(permissionToken&&(await access()).auto)schedule();}
  }
  async function refreshDetection() {
    if (!permissionToken || busy || detecting || document.hidden) return;
    if (!(await access()).allowed) return;
    const current = flow.next(candidates(), completed);
    if (!current || lastDetection === current.key) return;
    detecting = true;
    try {
      lastDetection = current.key;
      await chrome.runtime.sendMessage({type:'detected',data:publicData(current),token:permissionToken});
    } finally {detecting=false;}
  }
  function schedule() {
    if (!permissionToken) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {await refreshDetection(); await auto();} catch {}
    }, 500);
  }
  addEventListener('scroll', schedule, {passive:true});
  addEventListener('change', schedule, true);
  addEventListener('input', schedule, true);
  addEventListener('click', schedule, true);
  addEventListener('visibilitychange', schedule);
  new MutationObserver(schedule).observe(document.documentElement, {
    childList:true, subtree:true, characterData:true, attributes:true,
    attributeFilter:['class','hidden','aria-hidden','aria-checked','disabled']
  });
  chrome.storage.onChanged.addListener((changes,area) => {
    if (area==='local' && (changes.selectedModel || changes.model)) attempted.clear();
    schedule();
  });
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    try {
      if (message.type === 'authorize') {
        chrome.runtime.sendMessage({type:'session-status',token:message.token}).then(result=>{
          if(!result?.allowed){reply({error:'Reading is locked.'});return;}
          permissionToken=message.token;schedule();reply({ok:true});
        },error=>reply({error:error.message}));return true;
      }
      if (message.type === 'revoke') {
        lockReader();reply({ok:true});return;
      }
      requireRead(message.token);
      if (message.type === 'collect') reply({data:capture()});
      else if(message.type==='scan'){const found=candidates(true);reply({questions:found.map(item=>({...publicData(item),answered:flow.answered(item,completed)})),frames:document.querySelectorAll('iframe').length});}
      else if (message.type === 'select' || message.type === 'fill') {
        applyAnswer(message).then(reply, error => reply({error:error.message}));
        return true;
      }
      else if (message.type === 'wake') {attempted.clear();schedule(); reply({ok:true});}
      else if(message.type==='pause'){runner.stop();reply({ok:true});}
      else return;
    } catch(error) { reply({error:error.message}); }
  });
  schedule();
})();

