const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const files=new Set(['/tests/browser-content.html','/tests/browser-content.js','/tests/browser-setup.js','/flow.js','/runner.js','/choices.js','/content.js']);
http.createServer((req,res)=>{const file=new URL(req.url,'http://localhost').pathname;if(!files.has(file)){res.writeHead(404);return res.end('Not found');}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(path.join(root,file)).pipe(res);}).listen(8766,'127.0.0.1',()=>console.log('Reader DOM tests: http://127.0.0.1:8766/tests/browser-content.html'));
