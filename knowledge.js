/* Local reference retrieval. Short authored summaries, not a replacement for textbooks. */
(function(root){
 const MDN='https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_operators';
 const ISTQB='https://istqb.org/wp-content/uploads/2024/11/ISTQB-CTFL_Syllabus_2018_v3.1.1.pdf';
 const cards=[
 ['js-equality','JavaScript equality','javascript strict equality coercion equals comparison','=== compares without type coercion; == can convert operand types. Two distinct objects do not become equal merely because their properties match.',MDN],
 ['js-coercion','JavaScript boolean coercion','javascript true false empty array boolean numeric addition coercion','An empty array is truthy. ![] is false. In loose comparisons, true becomes 1 and [] can become 0; false + false evaluates to numeric 0.',MDN],
 ['js-operators','JavaScript assignment and operators','javascript assignment multiplication exponentiation arithmetic operators','= assigns a value. === compares. ** performs exponentiation. + can concatenate strings; the operand types matter when predicting output.',MDN],
 ['js-dom','HTML script and DOM','javascript html script element document getelementbyid innerhtml textcontent','JavaScript code belongs in an HTML script element. document.getElementById("demo") selects the element with that ID; textContent sets its plain text, whereas innerHTML parses HTML.', 'https://developer.mozilla.org/en-US/docs/Web/API/Document/getElementById'],
 ['js-functions','JavaScript function results','javascript function return undefined parameters arguments','A function that reaches its end without returning a value returns undefined. A return statement ends that function invocation.', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/return'],
 ['testing-levels','Test levels','component unit integration system acceptance testing levels','Component tests examine individual components. Integration tests examine interactions. System tests examine the complete system. Acceptance tests evaluate acceptance needs and criteria.',ISTQB],
 ['regression','Regression versus confirmation','regression confirmation retesting fixed defect change testing','Confirmation testing checks that a particular defect was fixed. Regression testing looks for unintended effects of a change in previously working behavior.',ISTQB],
 ['ep-bva','Input test design','equivalence partitioning boundary value analysis testing ordered input','Equivalence partitioning groups inputs expected to behave similarly. Boundary value analysis tests boundaries of ordered partitions, where defects commonly occur.',ISTQB],
 ['coverage','Coverage limits','statement branch coverage testing percentage correctness','Executing every statement does not necessarily exercise every branch. High structural coverage alone does not establish correctness or completeness.',ISTQB],
 ['sql-atomic','Atomic transactions','sql transaction acid atomicity rollback commit all or nothing','Atomicity means a transaction completes as a whole or has no committed partial effect. COMMIT accepts the transaction; ROLLBACK abandons it.', 'https://www.postgresql.org/docs/18/tutorial-transactions.html'],
 ['sql-isolation','Transaction isolation','sql transactions isolation concurrent dirty read repeatable serializable','Isolation concerns interference between concurrent transactions. Serializable aims for effects equivalent to some serial execution; applications may need to retry serialization failures.', 'https://www.postgresql.org/docs/current/transaction-iso.html'],
 ['sql-injection','SQL injection','sql injection untrusted query input parameter prepared statement','SQL injection occurs when untrusted data changes a query’s structure. Parameterized queries separate values from SQL syntax; input validation alone is insufficient.', 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet'],
 ['access-control','Access control','access control authorization authentication training dataset unauthorized access permission','Authentication establishes identity. Authorization and access control decide which resources or actions that identity may access. Restricting dataset access helps prevent unauthorized use.', 'https://community.owasp.org/Broken_Access_Control'],
 ['poisoning','Data poisoning','data poisoning malicious manipulate change training dataset model behaviour attack','Data poisoning targets training data, for example by inserting or altering examples to influence the learned model. Evasion instead targets inputs presented to a trained model.', 'https://csrc.nist.gov/glossary/term/data_poisoning'],
 ['ml-privacy','Training-data privacy attacks','machine learning privacy sensitive information training data extraction attack','A model can expose sensitive information about its training data. Privacy attacks seek such information; privacy protection is distinct from predictive accuracy.', 'https://csrc.nist.gov/glossary/term/data_privacy_attacks'],
 ['graph-bfs','Breadth-first traversal','graph bfs breadth first queue unweighted shortest path level traversal','Breadth-first search explores vertices by increasing edge distance from the start, using a queue. It finds shortest paths by number of edges in an unweighted graph.', 'https://opendsax.cs.vt.edu/ODSA/Books/Everything/html/GraphTraversal.html'],
 ['graph-dfs','Depth-first traversal','graph dfs depth first stack recursion traversal','Depth-first search explores a branch before backtracking. A recursion stack or explicit stack tracks the exploration; it does not generally find shortest paths.', 'https://opendsax.cs.vt.edu/ODSA/Books/Everything/html/GraphTraversal.html']
 ].map(([id,title,keywords,text,url])=>({id:'K-'+id,title,keywords,text,url,kind:'foundation'}));
 const stop=new Set('a an the which what who where when why how is are was were do does did this that with from into for and or of to in on by as be it its following correct answer question choose select not except'.split(' '));
 const tokens=text=>[...new Set(String(text||'').toLowerCase().match(/[a-z][a-z0-9+#.]{1,}/g)||[])].filter(term=>!stop.has(term));
 function chunks(notes=[]){
  return notes.flatMap(note=>{
   const text=String(note.text||'').slice(0,200000),parts=[];
   for(let start=0;start<text.length;start+=1400){const part=text.slice(start,start+1800);if(part.trim())parts.push({id:'N-'+note.id+'-'+start,title:String(note.title||'Study notes'),text:part,keywords:note.title||'',kind:'notes'});}
   return parts;
  });
 }
 function retrieve(question,notes=[],limit=4){
  const query=tokens(question);if(!query.length)return [];
  const corpus=[...cards,...chunks(notes)],index=corpus.map(item=>({item,terms:new Set(tokens(item.title+' '+item.keywords+' '+item.text))}));
  const frequency=new Map(query.map(term=>[term,index.filter(row=>row.terms.has(term)).length]));
  return index.map(({item,terms})=>{
   const matches=query.filter(term=>terms.has(term));
   const score=matches.reduce((sum,term)=>sum+Math.log(1+corpus.length/(1+frequency.get(term))),0)+(item.kind==='notes'?0.4:0);
   return {...item,score,matches:matches.length};
  }).filter(item=>item.matches>=2).sort((a,b)=>b.score-a.score).slice(0,limit);
 }
 const api={retrieve,cards,chunks};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StudyKnowledge=api;
})(globalThis);
