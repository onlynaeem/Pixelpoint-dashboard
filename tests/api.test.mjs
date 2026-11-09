process.env.ALLOW_LEGACY_TOKENS='true';
import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomBytes} from 'node:crypto';
import {Readable} from 'node:stream';
test('API auth, branch isolation, stale replay and empty replacement',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pp-test-'));process.env.DEMO='true';process.env.DEMO_DB=join(dir,'test.db');
 const key=randomBytes(32).toString('hex'),viewerToken=randomBytes(32).toString('hex');process.env.CLOUD_CONFIG=join(dir,'config.json');writeFileSync(process.env.CLOUD_CONFIG,JSON.stringify({viewers:[{token:viewerToken,tenant_id:'test',restaurant_ids:'*'}],restaurants:[{id:'r1',tenant_id:'test',name:'Synthetic one',currency:'BHD',timezone:'Asia/Bahrain',key},{id:'r2',tenant_id:'test',name:'Synthetic two',currency:'BHD',timezone:'Asia/Bahrain',key:randomBytes(32).toString('hex')}]}));
 const {start}=await import('../cloud/server.mjs');const app=await start(0);const base='http://127.0.0.1:'+app.server.address().port;
 const fetch=async(url,options={})=>new Promise(resolve=>{
 const req=Readable.from(options.body?[Buffer.from(options.body)]:[]);req.url=new URL(url).pathname+new URL(url).search;req.method=options.method||'GET';req.headers=Object.fromEntries(Object.entries(options.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
 let status=200;const res={setHeader(){},writeHead(code){status=code;},end(body){resolve({status,json:async()=>JSON.parse(body)});}};app.server.emit('request',req,res);
 });
 const upload=async(key,id,p)=>fetch(base+'/api/ingest',{method:'POST',headers:{Authorization:'Bearer '+key,'X-Restaurant-Id':id},body:JSON.stringify(p)});
 const p={day:'2026-10-26',sequence:10,reports:{transaction_summary:[{'Transaction #':1,'Net Total':10,'Final Total':11,Tax1:1,Tax2:0,Tax3:0,Tax4:0,Tax5:0}],transaction_detail:[],product:[],sales_type:[]}};
 try{
 for(const asset of ['/qrcodegen.js','/zatca.mjs','/reports.mjs'])assert.equal((await fetch(base+asset)).status,200);
 assert.equal((await upload(key,'r2',p)).status,401);
 assert.equal((await upload(key,'r1',p)).status,200);
 assert.equal((await (await upload(key,'r1',p)).json()).changed,false);
 assert.equal((await (await upload(key,'r1',{...p,sequence:9})).json()).changed,false);
 const path='/api/report?restaurant=r1&from=2026-10-26&to=2026-10-26';
 assert.equal((await fetch(base+path)).status,401);
 const get=()=>fetch(base+path,{headers:{Authorization:'Bearer '+viewerToken}});
 assert.equal((await (await get()).json()).totals.net,10);
 await upload(key,'r1',{...p,sequence:11,reports:{...p.reports,transaction_summary:[]}});
 assert.equal((await (await get()).json()).totals.net,0);
 }finally{await app.close();rmSync(dir,{recursive:true});}
});
