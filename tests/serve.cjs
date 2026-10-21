const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const allowed=new Map([['/','practice.html'],['/practice.js','practice.js']]);
http.createServer((req,res)=>{
 const file=allowed.get(new URL(req.url,'http://localhost').pathname);
 if(!file){res.writeHead(404);return res.end('Not found');}
 res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});
 fs.createReadStream(path.join(__dirname,file)).pipe(res);
}).listen(8765,'127.0.0.1',()=>console.log('Practice test pages: http://127.0.0.1:8765\nKeep this terminal open. Press Ctrl+C to stop.'));
