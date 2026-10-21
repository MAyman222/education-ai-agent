const params=new URLSearchParams(location.search),mode=params.get('mode')||'scroll';
let index=Math.min(99,Math.max(0,Number(params.get('q'))||0)),correct=Number(params.get('score'))||0,checks=0;
function question(i){
 const root=document.createElement('fieldset');root.className='question';root.dataset.question=String(i);
 const legend=document.createElement('legend');legend.textContent='Question '+(i+1)+' of 100';root.append(legend);
 const text=document.createElement('p');text.textContent=i%3===0?'What is 2 + 2?':i%3===1?'Calculate 2 + 2. Write only the numeral.':'Scenario: Two students join two students already in a room. How many students are in the room? Write only the numeral.';root.append(text);
 if(i%3===0){for(const [j,label]of ['3','4','5'].entries()){const row=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='q'+i;input.value=label;input.id='q'+i+'-'+j;row.htmlFor=input.id;row.append(input,document.createTextNode(label));root.append(row);}}
 else{const field=document.createElement('textarea');field.setAttribute('aria-label','Answer');root.append(field);}
 const check=document.createElement('button');check.textContent='Check answer';root.append(check);
 const feedback=document.createElement('p');feedback.className='feedback';feedback.setAttribute('role','status');root.append(feedback);
 check.addEventListener('click',()=>{
  const answer=i%3===0?root.querySelector('input:checked')?.value:root.querySelector('textarea').value.trim();
  if(!answer){feedback.textContent='Enter an answer first.';return;}
  checks++;const isCorrect=answer==='4'&&!(mode==='wrong'&&i===1);if(isCorrect)correct++;feedback.textContent=isCorrect?'Correct!':'Incorrect. Review this answer.';check.disabled=true;update();
 });
 if(mode!=='scroll'&&i<99){const next=document.createElement('button');next.textContent='Next question';next.addEventListener('click',()=>{index++;if(mode==='reload')location.href='?mode=reload&q='+index+'&score='+correct;else render();});root.append(next);}
 if(i===99){const finish=document.createElement('button');finish.textContent='Finish quiz';finish.addEventListener('click',()=>{document.getElementById('result').textContent='Finished. Website marked '+correct+' / 100 correct.';finish.disabled=true;});root.append(finish);}
 return root;
}
function update(){document.getElementById('progress').textContent=mode==='scroll'?checks+' answers checked':('Question '+(index+1)+' of 100 · '+correct+' correct so far');}
function render(){document.getElementById('quiz').replaceChildren(...(mode==='scroll'?Array.from({length:100},(_,i)=>question(i)):[question(index)]));update();}
render();
