import {flushOutbox,checkQueueCapacity} from './outbox.mjs';
import {recordEvent} from './events.mjs';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,renameSync,unlinkSync,openSync,closeSync} from 'node:fs';
import {resolve} from 'node:path';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {nextSequence} from './sequence.mjs';
import {createSchedule} from '../scripts/sync-schedule.mjs';
import {parseRange,planDays} from './sync-plan.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const cfg=JSON.parse(readFileSync(process.env.CONNECTOR_CONFIG||'connector/config.json','utf8').replace(/^\uFEFF/,''));
const api=new URL(cfg.api_url);
if(api.protocol!=='https:'&&!(cfg.allow_http_local&&['127.0.0.1','localhost'].includes(api.hostname)))throw Error('HTTPS required');
if(!['interval','daily'].includes(cfg.mode)||!Number.isInteger(cfg.lookback_days)||cfg.lookback_days<1||cfg.lookback_days>366||cfg.interval_seconds<30)throw Error('Invalid schedule');
createSchedule(cfg);
const backfill=parseRange(process.argv.slice(2));
const currentParts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:cfg.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const requestedDays=planDays(currentParts.year+'-'+currentParts.month+'-'+currentParts.day,cfg.lookback_days,backfill);
if(process.argv.includes('--plan')){console.log(JSON.stringify({restaurant_id:cfg.restaurant_id,timezone:cfg.timezone,days:requestedDays},null,2));process.exit(0);}
const owner=cfg.source_owner||'DBA';if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(owner))throw Error('Invalid source_owner');
const key=process.env[cfg.key_env];if(!key)throw Error('Missing API key environment variable');
const out=resolve(cfg.outbox);mkdirSync(out,{recursive:true});
function event(state){try{recordEvent(resolve(out,'logs'),state);}catch{console.error('Connector event log could not be written.');}}
let lock;try{lock=openSync(resolve(out,'agent.lock'),'wx');}catch{throw Error('Agent already running, or stale lock; see README');}
writeFileSync(lock,String(process.pid));
function cleanup(){try{closeSync(lock);}catch{}try{const path=resolve(out,'agent.lock');if(readFileSync(path,'utf8')===String(process.pid))unlinkSync(path);}catch{}}
process.on('exit',cleanup);process.on('SIGINT',()=>process.exit());process.on('SIGTERM',()=>process.exit());
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function localParts(){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:cfg.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(p=>[p.type,p.value]));}
async function flush(){return flushOutbox({directory:out,api,key,restaurantId:cfg.restaurant_id});}
async function cycle(){
 event('sync_started');
 await flush();
 const stateResponse=await fetch(new URL('/api/connector-state',api),{headers:{Authorization:'Bearer '+key,'X-Restaurant-Id':cfg.restaurant_id},signal:AbortSignal.timeout(30000)});
 if(!stateResponse.ok)throw Error('Connector state HTTP '+stateResponse.status+'; update the API before this agent');
 let cloudFloor=(await stateResponse.json()).sequence;
 const p=localParts(),today=p.year+'-'+p.month+'-'+p.day;
 const days=planDays(today,cfg.lookback_days,backfill);let processed=0;
 for(const day of days){
 const reports=JSON.parse(execFileSync(cfg.powershell_path||'powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve('connector/read-odbc.ps1'),'-Day',day],{encoding:'utf8',maxBuffer:30*1024*1024,windowsHide:true,timeout:600000,env:{...process.env,PIXELPOINT_SOURCE_OWNER:owner}}));
 // Durable monotonic sequence survives restarts and wall-clock rollback.
 const sequence=nextSequence(resolve(out,'sequence.txt'),cloudFloor);cloudFloor=sequence;
 const file=resolve(out,sequence+'.json'),serialized=JSON.stringify({day,sequence,reports});checkQueueCapacity(out,Buffer.byteLength(serialized),cfg.max_outbox_bytes);writeFileSync(file+'.tmp',serialized);renameSync(file+'.tmp',file);
 await flush();
 processed++;console.log('Snapshot acknowledged',day,processed+'/'+days.length);
 }event('sync_completed');console.log(new Date().toISOString(),'Sync completed',cfg.restaurant_id);
}
let completedDay='',failures=0;
do{
 try{const p=localParts(),day=p.year+p.month+p.day,time=p.hour+':'+p.minute;
 if(cfg.mode==='interval'||(time>=cfg.daily_at&&day!==completedDay)||process.argv.includes('--once')){await cycle();completedDay=day;}
 failures=0;
 }catch(e){event('sync_failed');failures++;console.error(new Date().toISOString(),'Sync failed; queued data retained.',e.message);if(process.argv.includes('--once'))process.exitCode=1;}
 if(process.argv.includes('--once'))break;
 await sleep(failures?Math.min(300000,5000*2**Math.min(failures,6)):cfg.mode==='daily'?30000:cfg.interval_seconds*1000);
}while(true);


