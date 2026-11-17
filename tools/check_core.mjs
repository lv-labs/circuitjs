// One repeatable computational regression command; browser gestures are separate.
import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url),tools=new URL('./',import.meta.url);
const files=(await readdir(tools)).filter(name=>/^test_.*\.mjs$/.test(name)&&!name.includes('browser')).sort();
for(const name of files){
 const result=spawnSync(process.execPath,[new URL(name,tools).pathname],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
 if(result.status!==0){process.stderr.write(`FAIL ${name}\n${result.stdout||''}${result.stderr||''}${result.error||''}\n`);process.exit(1);}
 process.stdout.write(`PASS ${name}\n`);
}
console.log(`All ${files.length} computational suites passed. Browser checks are separate.`);
