/* Optional public evidence lookup. Call only after separate per-opening consent. */
(function(root){
 async function lookup(question,{signal}={}){
  const clause=String(question).replace(/^.*?(?:wants to know|hoping you can remember|find out that|It wants to know)\s+/i,'').replace(/\.{3,}/g,'').trim();
  const terms=clause.replace(/[^\p{L}\p{N}'’\s-]/gu,' ').split(/\s+/).filter(word=>word.length>2&&!/^(which|what|where|when|does|have|has|this|that|with|from|been|were|just|some|they|their|there|about|could|would|should|into|also|know|remember)$/i.test(word));
  const query=terms.slice(0,16).join(' ');
  if(!query)return [];
  const endpoint='https://en.wikipedia.org/w/api.php';
  async function call(params){
   const url=endpoint+'?'+new URLSearchParams({action:'query',format:'json',origin:'*',...params});
   const response=await fetch(url,{signal,credentials:'omit'});if(!response.ok)throw Error('Wikipedia HTTP '+response.status);const data=await response.json();if(data.error)throw Error(data.error.info||'Wikipedia lookup failed');return data;
  }
  let search=await call({list:'search',srsearch:query,srlimit:'3',srnamespace:'0'});
  if(!search.query?.search?.length){
   const names=clause.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g)||[];
   if(names.length)search=await call({list:'search',srsearch:names.slice(0,2).join(' '),srlimit:'3',srnamespace:'0'});
  }
  const ids=(search.query?.search||[]).map(page=>page.pageid);if(!ids.length)return [];
  const extracts=await call({pageids:ids.join('|'),prop:'extracts|info',inprop:'url',explaintext:'1',exchars:'6000'});
  return Object.values(extracts.query?.pages||{}).filter(page=>page.extract).map((page,i)=>({id:'W'+(i+1),title:page.title,url:page.fullurl||'https://en.wikipedia.org/?curid='+page.pageid,text:page.extract.slice(0,6000)}));
 }
 const api={lookup};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StudySources=api;
})(globalThis);
