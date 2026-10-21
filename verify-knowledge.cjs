const assert=require('node:assert/strict'),knowledge=require('./knowledge.js');
let found=knowledge.retrieve('Which attack manipulates malicious training data to change a model?');assert.ok(found.some(item=>item.id==='K-poisoning'));
found=knowledge.retrieve('What is the difference between regression testing and confirmation testing?');assert.ok(found.some(item=>item.id==='K-regression'));
found=knowledge.retrieve('What does JavaScript true == [] evaluate to?');assert.ok(found.some(item=>item.id==='K-js-coercion'));
found=knowledge.retrieve('Which quantum parameter is called flarnex in our lecture?', [{id:'course',title:'Physics lecture',text:'In this lecture, the quantum parameter flarnex is the sample coupling constant.'}]);assert.ok(found.some(item=>item.kind==='notes'&&item.text.includes('flarnex')));
assert.equal(knowledge.retrieve('where what the which').length,0);assert.equal(knowledge.retrieve('Arbitrary unrelated chardestron vaultminem').length,0);
assert.ok(knowledge.cards.every(item=>item.url.startsWith('https://')));assert.ok(knowledge.cards.length>=17);
assert.ok(knowledge.chunks([{id:'long',title:'Notes',text:'a'.repeat(200000)}]).every(chunk=>chunk.text.length<=1800));
console.log('PASS: source-linked foundation references, topic retrieval, imported subject notes, irrelevant-query rejection and bounded excerpt sizes. Retrieval is not a factual accuracy benchmark.');
