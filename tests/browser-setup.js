window.readerListener=null;window.readerMessages=[];window.mockAuto=false;window.flowEvents=[];
window.chrome={runtime:{sendMessage:async message=>{
 readerMessages.push(message);
 if(message.type==='session-status')return {allowed:message.token==='fixture-token',auto:mockAuto,submit:false};
 if(message.type==='answer'){
  if(window.mockReviewText&&message.data.question.includes(mockReviewText))return {review:true};
  return new Promise(resolve=>readerListener({type:'select',token:message.token,key:message.data.key,id:'1'},{},reply=>resolve({applied:!!reply.selected,error:reply.error})));
 }
 if(message.type==='flow-event'){flowEvents.push(message);if(['paused','finished'].includes(message.phase))window.mockAuto=false;}
 return {ok:true};
},onMessage:{addListener:listener=>window.readerListener=listener}},storage:{onChanged:{addListener:()=>{}}}};
