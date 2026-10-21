(function(root) {
  const selected = control => !!control?.checked || ['aria-checked','aria-pressed','aria-selected','data-selected'].some(name=>control?.getAttribute?.(name)==='true') || ['checked','selected'].includes(control?.getAttribute?.('data-state')) || ['selected','is-selected','is-checked','option-selected','answer-selected'].some(name=>control?.classList?.contains(name));
  function fieldValue(field){
    if(!field)return '';if(typeof field.value==='string')return field.value;
    if(field.cloneNode){const copy=field.cloneNode(true);for(const node of copy.querySelectorAll('[data-placeholder],[class*="placeholder"],[class*="Placeholder"],[aria-hidden="true"]'))node.remove();return copy.textContent||'';}
    return field.innerText||'';
  }
  function answered(candidate, completed) {
    return completed.has(candidate.key) || candidate.controls.some(selected) || !!(candidate.field && String(fieldValue(candidate.field)).trim());
  }
  function next(candidates, completed, attempted = new Set(), automatic = false) {
    const remaining = candidates.filter(candidate => !answered(candidate, completed) && (!automatic || !attempted.has(candidate.key)));
    return remaining.sort((a,b) => a.score-b.score)[0] || null;
  }
  const api = {selected,answered,next,fieldValue};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QuizCoachFlow = api;
})(globalThis);
