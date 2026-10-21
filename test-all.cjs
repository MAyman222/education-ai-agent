const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const run=args=>{const result=spawnSync(process.execPath,args,{cwd:__dirname,encoding:'utf8'});process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');if(result.status!==0)process.exit(result.status||1);};
for(const file of fs.readdirSync(__dirname).filter(file=>/\.(js|cjs)$/.test(file)))run(['--check',file]);
for(const file of fs.readdirSync(path.join(__dirname,'tests')).filter(file=>/\.(js|cjs)$/.test(file)))run(['--check',path.join('tests',file)]);
for(const file of fs.readdirSync(__dirname).filter(file=>/^verify.*\.cjs$/.test(file)).sort())run([file]);
console.log('\nALL NODE CHECKS PASSED. The separate real-DOM browser suite is documented in README.md. Live-site compatibility and model factual accuracy are separate checks.');
