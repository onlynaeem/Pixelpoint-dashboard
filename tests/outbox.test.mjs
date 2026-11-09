import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {flushOutbox,checkQueueCapacity} from '../connector/outbox.mjs';import {diagnose} from '../connector/diagnostics.mjs';import {defaultSync} from '../connector/sync-plan.mjs';
const snapshot=sequence=>({day:'2026-10-01',sequence,reports:{transaction_summary:[],transaction_detail:[],product:[],sales_type:[]}});
const settings=directory=>({directory,api:'https://example.invalid',key:'test-key',restaurantId:'r1'});
test('queue capacity stops growth without deleting existing files',()=>{const dir=mkdtempSync(join(tmpdir(),'pp-quota-'));try{writeFileSync(join(dir,'retained.tmp'),'retained');assert.throws(()=>checkQueueCapacity(dir,26214400,26214400));assert.throws(()=>checkQueueCapacity(dir,1,1));assert.equal(checkQueueCapacity(dir,1,26214400).bytes,8);assert.equal(readFileSync(join(dir,'retained.tmp'),'utf8'),'retained');}finally{rmSync(dir,{recursive:true,force:true});}});
test('outage retains queue; restart uploads oldest sequence first and removes only acknowledged files',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pp-queue-'));try{writeFileSync(join(dir,'10.json'),JSON.stringify(snapshot(10)));writeFileSync(join(dir,'2.json'),JSON.stringify(snapshot(2)));writeFileSync(join(dir,'sequence.txt'),'10');
 await assert.rejects(()=>flushOutbox({...settings(dir),send:async()=>{throw Error('offline');}}));assert.ok(existsSync(join(dir,'2.json')));assert.ok(existsSync(join(dir,'10.json')));
 const sent=[];const n=await flushOutbox({...settings(dir),send:async(url,options)=>{sent.push(JSON.parse(options.body).sequence);return {ok:true,json:async()=>({accepted:true,changed:sent.length!==1})};}});assert.equal(n,2);assert.deepEqual(sent,[2,10]);assert.equal(existsSync(join(dir,'2.json')),false);assert.equal(readFileSync(join(dir,'sequence.txt'),'utf8'),'10');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('partial success, rejection and malformed acknowledgements preserve pending data',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pp-ack-'));try{for(const n of [1,2])writeFileSync(join(dir,n+'.json'),JSON.stringify(snapshot(n)));let calls=0;
 await assert.rejects(()=>flushOutbox({...settings(dir),send:async()=>++calls===1?{ok:true,json:async()=>({accepted:true,changed:true})}:{ok:false,status:401}}));assert.equal(existsSync(join(dir,'1.json')),false);assert.ok(existsSync(join(dir,'2.json')));
 for(const ack of [null,{accepted:true},{accepted:false,changed:true}]){await assert.rejects(()=>flushOutbox({...settings(dir),send:async()=>({ok:true,json:async()=>ack})}));assert.ok(existsSync(join(dir,'2.json')));}
 await assert.rejects(()=>flushOutbox({...settings(dir),send:async()=>({ok:true,json:async()=>{throw Error('not json');}})}));assert.ok(existsSync(join(dir,'2.json')));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('corrupt first snapshot blocks uploads and remains untouched',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pp-corrupt-'));try{writeFileSync(join(dir,'1.json'),'broken');writeFileSync(join(dir,'2.json'),JSON.stringify(snapshot(2)));let sent=false;await assert.rejects(()=>flushOutbox({...settings(dir),send:async()=>{sent=true;}}));assert.equal(sent,false);assert.equal(readFileSync(join(dir,'1.json'),'utf8'),'broken');assert.ok(existsSync(join(dir,'2.json')));}finally{rmSync(dir,{recursive:true,force:true});}
});
test('diagnostics expose queue health without secrets, sales values or modifications',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pp-diag-'));try{writeFileSync(join(dir,'1.json'),JSON.stringify(snapshot(1)));writeFileSync(join(dir,'2.json'),'corrupt');writeFileSync(join(dir,'sequence.txt'),'bad');writeFileSync(join(dir,'agent.lock'),'123');
 const config={...defaultSync,restaurant_id:'r1',key_env:'PIXELPOINT_API_KEY',api_url:'https://private.example',timezone:'Asia/Bahrain',outbox:dir,key:'DO-NOT-PRINT-KEY',password:'DO-NOT-PRINT-PASSWORD'};const r=diagnose(config);assert.equal(r.queue.valid,1);assert.equal(r.queue.invalid,1);assert.equal(r.lock_present,true);assert.equal(r.sequence,null);assert.equal(r.queue.oldest_day,'2026-10-01');assert.ok(r.issues.length>=3);assert.ok(!JSON.stringify(r).includes('DO-NOT-PRINT'));assert.ok(!JSON.stringify(r).includes('private.example'));assert.equal(readFileSync(join(dir,'sequence.txt'),'utf8'),'bad');assert.equal(readFileSync(join(dir,'2.json'),'utf8'),'corrupt');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
