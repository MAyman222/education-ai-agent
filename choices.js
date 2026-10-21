/* Detect custom MCQ tiles without relying on a framework's generated class names. */
(function(root){
 const selector='button,[role="button"],[role="option"],[aria-pressed],[tabindex],[data-option],[data-answer],[class*="option"],[class*="Option"],[class*="answer"],[class*="Answer"],li,div[onclick],div';
 const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
 function label(node){
  const children=[...node.children];
  // Remove a separate keyboard-number badge, never a number that is part of the answer.
  if(children.length>1&&/^(?:\d{1,2}|[A-H])$/.test(clean(children[0].textContent))){
   const rest=clean(children.slice(1).map(child=>child.innerText||child.textContent).join(' '));if(rest)return rest;
  }
  return clean(node.getAttribute('data-option-label')||node.innerText||node.textContent||node.getAttribute('aria-label'));
 }
 function detect(document,{visible,textWithout,makeCandidate,navigation,radio,field,ignored,style,hasField=node=>!!node.querySelector(field)}){
  const eligible=[...document.querySelectorAll(selector)].filter(node=>{
   if(!visible(node)||node.disabled||node.getAttribute('aria-disabled')==='true'||node.closest(ignored+',a,nav,[role="navigation"]'))return false;
   if(node.matches(radio)||node.querySelector(radio)||hasField(node))return false;
   const text=label(node);if(!text||text.length>1600||navigation(text)||/^(?:submit|check|verify|reveal|back|previous|cancel|reset|explain|i.m right)$/i.test(text))return false;
   return node.matches('button,[role="button"],[role="option"],[aria-pressed],[tabindex="0"],[data-option],[data-answer]')||style(node).cursor==='pointer'||/(?:^|[-_\s])(?:answer|option|choice)(?:[-_\s]|$)/i.test(node.className||'');
  });
  // An answer can contain nested spans with option-like classes. Click the outer semantic control.
  const rank=node=>node.matches('button,[role="button"],[role="option"],[aria-pressed]')?3:node.matches('[tabindex="0"],[data-option],[data-answer]')?2:style(node).cursor==='pointer'?1:0;
  const leaves=eligible.filter(node=>!eligible.some(other=>other!==node&&((other.contains(node)&&(rank(other)>rank(node)||(rank(other)===rank(node)&&rank(node)>0)))||(node.contains(other)&&(rank(other)>rank(node)||(rank(other)===rank(node)&&rank(node)===0))))));
  const result=[],seen=new Set();
  for(const control of leaves){
   let scope=control.parentElement;
   for(let depth=0;scope&&scope!==document.body&&depth<7;depth++,scope=scope.parentElement){
    if(scope.querySelector(radio)||hasField(scope))break;
    const controls=leaves.filter(node=>scope.contains(node));if(controls.length>20)break;if(controls.length<2)continue;
    const question=textWithout(scope,controls);
    if(question.length<8||!/(?:\?|\b(?:which|what|who|where|when|why|how|select|choose|identify|complete|true|false|following|scenario)\b)/i.test(question))continue;
    const options=controls.map((node,i)=>({id:String(i+1),text:label(node)}));
    if(new Set(options.map(option=>option.text)).size!==options.length)break;
    const candidate=makeCandidate('choice',scope,question,options,controls);
    if(candidate&&!seen.has(candidate.key)){seen.add(candidate.key);result.push(candidate);}break;
   }
  }
  return result;
 }
 const api={detect,label};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.QuizCoachChoices=api;
})(globalThis);
