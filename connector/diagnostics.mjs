import {readFileSync,existsSync,lstatSync} from 'node:fs';import {join,resolve} from 'node:path';import {queuedFiles,readQueued} from './outbox.mjs';import {validateSync} from './sync-plan.mjs';
export function diagnose(config,{root=process.cwd()}={}){
 const issues=[];try{validateSync(config);}catch{issues.push('Invalid synchronization schedule.');}
 try{new Intl.DateTimeFormat('en',{timeZone:config.timezone||'INVALID'});}catch{issues.push('Invalid restaurant timezone.');}
 try{const u=new URL(config.api_url);if(u.protocol!=='https:'&&!(config.allow_http_local===true&&u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error();}catch{issues.push('Invalid or insecure API URL.');}
 if(typeof config.restaurant_id!=='string'||!config.restaurant_id)issues.push('Restaurant ID is missing.');
 if(typeof config.key_env!=='string'||!config.key_env)issues.push('API key environment-variable name is missing.');
 const result={checked_at:new Date().toISOString(),restaurant_id:config.restaurant_id||null,checks:'Local files and configuration only; no database or network connection attempted.',queue:{files:0,bytes:0,valid:0,invalid:0,oldest_day:null,newest_day:null},lock_present:false,sequence:null,issues};
 if(typeof config.outbox!=='string'||!config.outbox){issues.push('Outbox path is missing.');return result;}
 const dir=resolve(root,config.outbox);if(!existsSync(dir)){issues.push('Outbox has not been created; this may be normal before first run.');return result;}
 result.lock_present=existsSync(join(dir,'agent.lock'));if(result.lock_present)issues.push('Agent lock exists. It may indicate a running process; do not delete without checking.');
 const sequence=join(dir,'sequence.txt');if(existsSync(sequence)){try{const raw=readFileSync(sequence,'utf8').trim(),n=Number(raw);if(!/^\d+$/.test(raw)||!Number.isSafeInteger(n))throw Error();result.sequence=n;}catch{issues.push('Local sequence state is unreadable or corrupt.');}}
 try{for(const name of queuedFiles(dir)){result.queue.files++;try{result.queue.bytes+=lstatSync(join(dir,name)).size;const p=readQueued(dir,name);result.queue.valid++;if(!result.queue.oldest_day||p.day<result.queue.oldest_day)result.queue.oldest_day=p.day;if(!result.queue.newest_day||p.day>result.queue.newest_day)result.queue.newest_day=p.day;}catch{result.queue.invalid++;}}}catch{issues.push('Cannot enumerate the outbox.');}
 if(result.queue.invalid)issues.push('Invalid queued snapshots require operator review; no files were changed.');return result;
}
if(process.argv[1]?.endsWith('diagnostics.mjs')){
 try{const config=JSON.parse(readFileSync(process.argv[2]||process.env.CONNECTOR_CONFIG||'connector/config.json','utf8').replace(/^\uFEFF/,''));const report=diagnose(config);console.log(JSON.stringify(report,null,2));process.exitCode=report.issues.length?1:0;}catch{console.error('Cannot inspect connector configuration or local outbox. No files were changed.');process.exitCode=1;}
}
