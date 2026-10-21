const assert=require('node:assert/strict');
const {create,classify}=require('./runner.js');
async function fixture(config={}){
 const count=config.count||1,items=Array.from({length:count},(_,i)=>({key:'q'+i,done:false}));
 let index=0,allowed=true,auto=true,submit=!!config.submit,events=[],clicks=[],answers=0,scrolls=0,checks=new Set(),navigated=new Set(),runner;
 const page={
  access:async()=>({allowed,auto,submit}),wait:async()=>{},
  next:async()=>{if(config.scroll)return items.find(item=>!item.done)||null;return items[index]&&!items[index].done?items[index]:null;},
  scroll:async()=>{scrolls++;},
  answer:async item=>{answers++;if(config.review&&answers===1){item.done=true;return {review:true};}if(config.revoke){allowed=false;return {applied:true};}if(config.stop){runner.stop();return {applied:true};}if(config.uncertain)return {applied:false};item.done=true;if(config.immediate)index++;return {applied:true};},
  summary:async()=>({complete:!config.undetected&&items.every(item=>item.done)}),
  controls:async()=>({ambiguous:config.ambiguous,check:config.check&&!checks.has(index)?'check':null,next:!config.scroll&&index<count-1?'next':null,finish:config.finish&&index===count-1?'finish':null}),
  click:async(node,kind)=>{assert.ok(allowed&&auto);if(kind!=='next')assert.ok(submit);clicks.push(kind);if(kind==='check')checks.add(index);if(kind==='next'){index++;navigated.add(index-1);}},
  feedback:async()=>checks.has(index)||config.immediateFeedback?(config.wrong?'incorrect':config.unknown?null:'correct'):null,
  changed:async item=>config.immediate||navigated.has(Number(item.key.slice(1))),
  event:async(phase,message,key)=>{events.push({phase,message,key});if(['paused','finished'].includes(phase))auto=false;}
 };
 runner=create(page);await Promise.all([runner.start(),runner.start()]);
 return {answers,scrolls,clicks,events};
}
(async()=>{
 let r=await fixture({count:100,scroll:true});assert.equal(r.answers,100);assert.equal(r.scrolls,100);assert.equal(r.clicks.length,0);assert.equal(r.events.at(-1).phase,'finished');
 r=await fixture({count:100});assert.equal(r.answers,100);assert.equal(r.clicks.length,99);
 r=await fixture({count:5,check:true});assert.equal(r.answers,1);assert.equal(r.clicks.length,0);assert.match(r.events.at(-1).message,/Allow submit/);
 r=await fixture({count:5,check:true,finish:true,submit:true});assert.equal(r.answers,5);assert.equal(r.clicks.filter(x=>x==='check').length,5);assert.equal(r.clicks.filter(x=>x==='next').length,4);assert.equal(r.clicks.filter(x=>x==='finish').length,1);
 r=await fixture({wrong:true,immediateFeedback:true});assert.equal(r.clicks.length,0);assert.match(r.events.at(-1).message,/incorrect/);
 r=await fixture({check:true,wrong:true,submit:true});assert.equal(r.clicks.length,1);assert.match(r.events.at(-1).message,/incorrect/);
 r=await fixture({uncertain:true});assert.equal(r.clicks.length,0);assert.equal(r.events.at(-1).phase,'paused');
 r=await fixture({count:3,scroll:true,review:true});assert.equal(r.answers,3);assert.equal(r.events.filter(x=>x.phase==='review').length,1);assert.match(r.events.at(-1).message,/need review/);assert.equal(r.events.at(-1).phase,'paused');
 r=await fixture({ambiguous:true});assert.equal(r.clicks.length,0);assert.equal(r.events.at(-1).phase,'paused');
 r=await fixture({revoke:true});assert.equal(r.clicks.length,0);assert.equal(r.events.length,0);
 r=await fixture({stop:true});assert.equal(r.clicks.length,0);
 r=await fixture({count:5,immediate:true});assert.equal(r.answers,5);assert.equal(r.clicks.length,0);
 r=await fixture({check:true,submit:true,unknown:true});assert.match(r.events.find(x=>x.phase==='checked').message,/did not report/);
 r=await fixture({count:1,undetected:true});assert.equal(r.events.at(-1).phase,'paused');assert.match(r.events.at(-1).message,/does not mean/);
 assert.equal(classify('Next →'),'next');assert.equal(classify('Submit all and finish'),'finish');assert.equal(classify('Check answer'),'check');
 for(const text of ['Buy now','Submit','Continue','Delete account','Next article','Sign in','Next 20 products'])assert.equal(classify(text),null);
 console.log('PASS: continuous runner — 100-question scrolling, 100-question pagination, submit gating, checking, finish, wrong/unknown feedback, uncertainty, ambiguity, revocation, pause, duplicate start and immediate advance; conservative control labels.');
})().catch(error=>{console.error(error);process.exitCode=1});
