const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/popup.js','utf8');
(async()=>{
 const state={token:'opening-token',submitAllowed:false,flowState:{phase:'ready'},starts:0,saves:0,fail:false,
  action:(id,handler)=>{state.handler=handler;},paintPermission:()=>{},status:message=>{state.message=message;},
  saveSettings:async()=>{state.saves++;if(state.fail)throw Error('Could not configure the session');},
  setAuto:async enabled=>{assert.ok(enabled);state.starts++;}};
 vm.createContext(state);vm.runInContext(source.slice(source.indexOf("action('submit',"),source.indexOf("action('stop',")),state);
 await state.handler();assert.equal(state.submitAllowed,true);assert.equal(state.starts,0,'Grant alone must not start a new quiz');
 await state.handler();assert.equal(state.submitAllowed,false);assert.equal(state.starts,0);
 state.flowState={phase:'paused',message:'Answer entered. Allow submit to check it and continue.'};
 await state.handler();assert.equal(state.starts,1);assert.match(state.message,/Continuing/);
 state.fail=true;await assert.rejects(state.handler,/Could not configure/);assert.equal(state.submitAllowed,true,'Failed grant/revoke must restore previous UI state');
 state.fail=false;state.token=null;await assert.rejects(state.handler,/Allow read/);assert.equal(state.starts,1);
 console.log('PASS: production Allow submit UI — separate grant, resumes a permission-paused run, does not start an idle run, failed updates roll back, and Allow read is required. UI dependencies are mocked.');
})().catch(error=>{console.error(error);process.exitCode=1});
