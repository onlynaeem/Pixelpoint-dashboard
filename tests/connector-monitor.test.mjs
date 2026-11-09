import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {nextSequence} from '../connector/sequence.mjs';import {monitorRows} from '../cloud/monitor.mjs';
import {Readable} from 'node:stream';
test('sequence recovery exceeds cloud and local state despite clock rollback; corrupt state stops safely',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pp-seq-')),path=join(dir,'sequence.txt');try{
 assert.equal(nextSequence(path,500,100),501);assert.equal(nextSequence(path,0,90),502);assert.equal(readFileSync(path,'utf8'),'502');
 writeFileSync(path,'garbled');assert.throws(()=>nextSequence(path,600,100));assert.equal(readFileSync(path,'utf8'),'garbled');
 assert.throws(()=>nextSequence(path,NaN));writeFileSync(path,String(Number.MAX_SAFE_INTEGER));assert.throws(()=>nextSequence(path,0,1));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('monitor separates never synced, recent empty snapshot, stale and other restaurants',()=>{
 const now=Date.parse('2026-11-09T12:00:00Z');const states=[{restaurant_id:'a',last_received_at:'2026-11-09T11:59:00Z',latest_day:'2026-11-09',sequence:10,snapshot_days:1},{restaurant_id:'b',last_received_at:'2026-11-09T10:00:00Z',sequence:9}];
 const rows=monitorRows(['a','b','c'].map(id=>({id,name:id})),states,now);assert.deepEqual(rows.map(r=>r.status),['recent','stale','never_synced']);assert.equal(rows[0].age_seconds,60);assert.equal(rows[2].sequence,0);
 assert.deepEqual(monitorRows([{id:'c'}],states,now).map(r=>r.restaurant_id),['c']);
});
test('connector recovery and monitoring enforce restaurant and tenant access, replay does not refresh freshness',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pp-monitor-'));process.env.DEMO='true';process.env.DEMO_DB=join(dir,'test.db');process.env.CLOUD_CONFIG=join(dir,'cloud.json');process.env.ALLOW_LEGACY_TOKENS='true';
 const key='test-connector-long-key-123456789';writeFileSync(process.env.CLOUD_CONFIG,JSON.stringify({viewers:[{token:'test-viewer-token',tenant_id:'t1',restaurant_ids:['a']}],restaurants:[{id:'a',tenant_id:'t1',name:'A',currency:'BHD',timezone:'Asia/Bahrain',key},{id:'b',tenant_id:'t2',name:'B',currency:'BHD',timezone:'Asia/Bahrain',key:'other-connector-long-key-123456'}]}));
 const {start}=await import('../cloud/server.mjs');const app=await start(0);const base='http://127.0.0.1:'+app.server.address().port;
 const request=(path,token,extra={})=>new Promise(resolve=>{const req=Readable.from([]);req.url=path;req.method='GET';req.headers=Object.fromEntries(Object.entries({Authorization:'Bearer '+token,...extra}).map(([k,v])=>[k.toLowerCase(),v]));let status=200;const res={setHeader(){},writeHead(code){status=code;},end(body){resolve({status,json:async()=>JSON.parse(body)});}};app.server.emit('request',req,res);});
 try{
 assert.equal((await request('/api/connectors','')).status,401);
 assert.equal((await request('/api/connector-state',key,{'X-Restaurant-Id':'b'})).status,401);
 let response=await request('/api/connector-state',key,{'X-Restaurant-Id':'a'});assert.equal((await response.json()).sequence,0);
 const p={day:'2026-11-09',sequence:9000,reports:{transaction_summary:[],transaction_detail:[],product:[],sales_type:[]}};await app.store.put('a',p);await app.store.put('b',{...p,sequence:9900});
 const before=await app.store.connectorStates(['a']);assert.equal(await app.store.put('a',p),false);assert.deepEqual(await app.store.connectorStates(['a']),before);
 response=await request('/api/connector-state',key,{'X-Restaurant-Id':'a'});const state=await response.json();assert.deepEqual(state,{restaurant_id:'a',sequence:9000});
 response=await request('/api/connectors','test-viewer-token');const data=await response.json();assert.equal(data.connectors.length,1);assert.equal(data.connectors[0].restaurant_id,'a');assert.equal(data.connectors[0].status,'recent');assert.ok(!JSON.stringify(data).includes(key));
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
