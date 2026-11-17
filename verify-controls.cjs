// Executes the production reader's control discovery and click adapter.
// This minimal DOM double tests scoping/permission logic, not browser compatibility.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {classify}=require('./runner.js');
const source=fs.readFileSync(__dirname+'/content.js','utf8');
class Element{
 constructor(tag='section',text='',attrs={}){this.tag=tag;this.innerText=text;this.textContent=text;this.attrs=attrs;this.children=[];this.disabled=false;this.isConnected=true;this.clicks=0;this.key='';}
 add(...children){for(const child of children){child.parentElement=this;this.children.push(child);}return this;}
 contains(node){return this===node||this.children.some(child=>child.contains(node));}
 getAttribute(name){return this.attrs[name]??null;}
 hasAttribute(name){return name in this.attrs;}
 matches(selector){return selector.split(',').some(part=>{
  part=part.trim();if(part===':disabled')return this.disabled;
  if(part==='[role="navigation"]')return this.attrs.role==='navigation';
  if(part==='[data-quiz]')return 'data-quiz' in this.attrs;
  if(part==='.quiz')return this.attrs.class==='quiz';
  if(part==='#quizcontainer')return this.attrs.id==='quizcontainer';
  if(part==='[hidden]'||part==='[data-quiz-coach]')return this.hasAttribute(part.slice(1,-1));
  if(part==='[aria-hidden="true"]')return this.attrs['aria-hidden']==='true';
  return this.tag===part;
 });}
 closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
 querySelectorAll(selector){const nodes=this.children.flatMap(child=>[child,...child.querySelectorAll('*')]);
  if(selector==='*')return nodes;
  if(selector==='svg title,img[alt]')return [];
  return nodes.filter(node=>['button','input','a'].includes(node.tag)||node.attrs.role==='button');
 }
 scrollIntoView(){}
 click(){this.clicks++;}
}
function setup({footer=false,nested=0}={}){
 const body=new Element('body'),main=new Element('main'),section=new Element(),root=new Element('fieldset');
 body.add(main);main.add(section);let wrapper=section;for(let i=0;i<nested;i++){const child=new Element();wrapper.add(child);wrapper=child;}wrapper.add(root);
 const input=new Element('input');root.add(input);
 const anchor={key:'q1',root,controls:[input],done:true};
 const context=vm.createContext({QuizCoachRunner:{classify},document:{body},location:{href:'https://quiz.test/test',origin:'https://quiz.test'},URL,
  candidates:()=>context.items,items:[anchor],lastItem:anchor,completed:new Set(['q1']),usedControls:new WeakMap(),
  requireRead:()=>{assert.ok(context.permission.allowed);},visible:node=>!node.hidden,
  clean:value=>String(value||'').replace(/\s+/g,' ').trim(),associated:()=>[],
  flow:{answered:question=>question.done},permission:{allowed:true,auto:true,submit:true},access:async()=>context.permission});
 vm.runInContext(source.slice(source.indexOf('  function quizControls('),source.indexOf('  const runner='))+'\nglobalThis.controls=quizControls;',context);
 const click=source.slice(source.indexOf('    click:async('),source.indexOf('    feedback:async'));
 vm.runInContext('globalThis.adapter=({'+click+'});',context);
 const controls=footer?new Element('footer'):section;if(footer)section.add(controls);
 return {context,body,main,section,root,controls,anchor};
}
(async()=>{
 let f=setup({footer:true,nested:8});const next=new Element('button','❯'),submit=new Element('button','Submit');f.root.add(next);f.controls.add(submit);
 let found=f.context.controls(f.anchor);assert.equal(found.next,next);assert.equal(found.check,submit);assert.ok(!found.ambiguous);
 // A tooltip must not hide a usable visible label; Done checks instead of ending the run.
 const done=new Element('button','Done',{title:'Complete this question'});f.controls.children=[done];done.parentElement=f.controls;
 found=f.context.controls(f.anchor);assert.equal(found.check,done);
 for(const label of ['Mark','Mark my answer','Check answer','Verify','Reveal answer']){done.innerText=label;assert.equal(f.context.controls(f.anchor).check,done);}
 next.innerText='';next.attrs['aria-label']='Next question';assert.equal(f.context.controls(f.anchor).next,next);
 next.attrs['aria-label']='Unhelpful tooltip';next.innerText='arrow_forward';assert.equal(f.context.controls(f.anchor).next,next);
 // Do not submit a page-wide form before all detected questions are answered.
 const otherRoot=new Element('fieldset'),other={key:'q2',root:otherRoot,controls:[],done:false};f.section.add(otherRoot);f.context.items.push(other);
 assert.equal(f.context.controls(f.anchor).check,undefined);other.done=true;assert.equal(f.context.controls(f.anchor).check,done);
 const otherMark=new Element('button','Mark');otherRoot.add(otherMark);assert.equal(f.context.controls(f.anchor).check,done);
 // Repeated/disabled/ambiguous controls must not be clicked speculatively.
 f.context.usedControls.set(done,'q1');assert.equal(f.context.controls(f.anchor).check,undefined);f.context.usedControls.delete(done);
 done.disabled=true;assert.equal(f.context.controls(f.anchor).check,undefined);done.disabled=false;
 const duplicate=new Element('button','Mark');f.controls.add(duplicate);assert.equal(f.context.controls(f.anchor).ambiguous,true);f.controls.children.pop();
 f=setup();const navigation=new Element('nav'),outside=new Element('a','Next');outside.href='https://quiz.test/article';navigation.add(outside);f.body.add(navigation);
 assert.equal(f.context.controls(f.anchor).next,undefined,'Site navigation is not quiz navigation');
 const cross=new Element('a','Next question');cross.href='https://other.test/private';f.section.add(cross);assert.equal(f.context.controls(f.anchor).next,undefined);
 // Exercise the actual click adapter with grants on/off and form validation.
 const mark=new Element('button','Mark');f.section.add(mark);
 f.context.permission.submit=false;await assert.rejects(()=>f.context.adapter.click(mark,'check'),/permission/);assert.equal(mark.clicks,0);
 const formNext=new Element('button','Next');formNext.form={checkValidity:()=>true};formNext.type='submit';
 await assert.rejects(()=>f.context.adapter.click(formNext,'next'),/also submits/);assert.equal(formNext.clicks,0);
 f.context.permission.submit=true;await f.context.adapter.click(mark,'check');assert.equal(mark.clicks,1);
 await assert.rejects(()=>f.context.adapter.click(mark,'check'),/changed/);assert.equal(mark.clicks,1);
 await f.context.adapter.click(formNext,'next');assert.equal(formNext.clicks,1);
 const invalid=new Element('button','Submit');invalid.form={checkValidity:()=>false};invalid.type='submit';
 await assert.rejects(()=>f.context.adapter.click(invalid,'check'),/requires another field/);assert.equal(invalid.clicks,0);
 invalid.form.checkValidity=()=>true;await f.context.adapter.click(invalid,'check');assert.equal(invalid.clicks,1);
 f.context.permission.auto=false;await assert.rejects(()=>f.context.adapter.click(new Element('button','Next'),'next'),/permission/);
 console.log('PASS: production control discovery/click adapter — footer Submit, deeply nested controls, Mark/Done, arrows and accessible labels, pending-question protection, other-question isolation, duplicate/disabled/stale controls, cross-origin/site-nav exclusion, submit/form gates, validation retry and paused actions. DOM is a test double.');
})().catch(error=>{console.error(error);process.exitCode=1});
