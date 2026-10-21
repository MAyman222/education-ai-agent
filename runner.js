/* Continuous practice workflow. All page actions are delegated to a gated adapter. */
(function(root){
 const classify = text => {
  text=String(text||'').replace(/[→›»❯➜⟶]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  if(/^(check|verify|reveal|show)( (my|your|the))? answer(s)?$/.test(text)||/^submit answer(s)?$/.test(text))return 'check';
  if(/^(next|next question|next page|continue quiz|continue to next question)$/.test(text))return 'next';
  if(/^(submit quiz|submit all( and finish)?|finish quiz|finish attempt|submit all answers)$/.test(text))return 'finish';
  return null;
 };
 function create(page){
  let running=false,epoch=0;
  const guard=async ticket=>{const access=await page.access();if(ticket!==epoch||!access.allowed||!access.auto)throw Error('Stopped');return access;};
  async function start(){
   if(running)return;running=true;const ticket=++epoch;
   try{
    let steps=0,reviewCount=0;
    const waitForNext=async item=>{
     for(let tries=0;tries<40;tries++){
      await guard(ticket);if((item&&await page.changed(item))||await page.next())return true;
      await page.wait(250);
     }return false;
    };
    while(true){
     await guard(ticket);
     if(++steps>1000){await page.event('paused','Practice limit reached. Start again to continue.');break;}
     const item=await page.next();
     if(item){
      await guard(ticket);await page.scroll(item);await page.wait(350);await guard(ticket);
      const result=await page.answer(item);
      await guard(ticket);
      if(result?.review){reviewCount++;await page.event('review','Answer needs review; continuing with other detected questions.',item.key);continue;}
      if(!result?.applied){await page.event('paused',result?.error||'Answer needs review. Automatic practice paused.');break;}
      await page.event('answered','Answer entered.',item.key);
      await page.wait(500);await guard(ticket);
      const immediate=await page.feedback(item);
      if(immediate==='correct'||immediate==='incorrect')await page.event('checked',immediate,item.key);
      if(immediate==='incorrect'){await page.event('paused','The website marked this answer incorrect. Review it before continuing.');break;}
      const controls=await page.controls(item);
      if(controls.ambiguous){await page.event('paused','Several quiz controls match. Choose the correct control on the page.');break;}
      const permission=await guard(ticket);
      if(controls.check){
       if(!permission.submit){await page.event('paused','Answer entered. Allow submit to check it and continue.');break;}
       await page.click(controls.check,'check',ticket);await page.wait(900);await guard(ticket);
       const feedback=await page.feedback(item);
       await page.event('checked',feedback||'Check clicked; the website did not report a clear result.',item.key);
       if(feedback==='incorrect'){await page.event('paused','The website marked this answer incorrect. Review it before continuing.');break;}
      }
      // Some quizzes advance immediately after selection/check. Never click a stale Next.
      if(await page.changed(item)){continue;}
      if(await page.next())continue;
      const after=await page.controls(item);
      if(after.ambiguous){await page.event('paused','Several navigation controls match. Continue on the page.');break;}
      if(after.next){await guard(ticket);await page.click(after.next,'next',ticket);
       if(!(await waitForNext(item))){await page.event('paused','Next did not open another question within 10 seconds. Continue on the page, then Start.');break;}continue;}
      if(after.finish){
       if(!(await guard(ticket)).submit){await page.event('paused','Answers entered. Allow submit to finish this practice quiz.');break;}
       await page.click(after.finish,'finish',ticket);await page.event('finished','Finish clicked. Check the website for your result.');break;
      }
      // Read-only text questions have no page entry; the answer adapter pauses above.
      continue;
     }
     if(reviewCount){await page.event('paused',reviewCount+' question(s) need review. Other detected questions were processed; nothing has been declared finished.');break;}
     // Resume after pause: a selected last question may still need Check or Next.
     const controls=await page.controls(null);
     if(controls.ambiguous){await page.event('paused','Navigation is ambiguous. Continue on the page.');break;}
     const permission=await guard(ticket);
     if(controls.check){
      if(!permission.submit){await page.event('paused','Allow submit to check the answer and continue.');break;}
      await page.click(controls.check,'check',ticket);await page.wait(900);await guard(ticket);
      const feedback=await page.feedback(null);await page.event('checked',feedback||'No clear website feedback.');
      if(feedback==='incorrect'){await page.event('paused','Website reported an incorrect answer. Review before continuing.');break;}
     }
     const after=await page.controls(null);
     if(after.ambiguous){await page.event('paused','Navigation is ambiguous. Continue on the page.');break;}
     if(after.next){await guard(ticket);await page.click(after.next,'next',ticket);
      if(!(await waitForNext(null))){await page.event('paused','No new unanswered question detected within 10 seconds of Next.');break;}continue;}
     if(after.finish){if(!permission.submit){await page.event('paused','Allow submit to finish this practice quiz.');break;}await guard(ticket);await page.click(after.finish,'finish',ticket);await page.event('finished','Finish clicked. Check the website for your result.');break;}
     const summary=await page.summary?.();
     if(summary?.complete)await page.event('finished','All recognised questions have been answered. Review the website result.');
     else await page.event('paused',summary?.message||'No selectable question detected. The page may use unsupported controls; this does not mean the quiz is finished.');
     break;
    }
   }catch(error){if(error.message!=='Stopped')await page.event('paused',error.message);}
   finally{running=false;}
  }
  return {start,stop(){epoch++;},get running(){return running;}};
 }
 const api={create,classify};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.QuizCoachRunner=api;
})(globalThis);
