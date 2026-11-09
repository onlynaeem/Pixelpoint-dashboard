// Run only against a new, isolated test database, never a live deployment.
import assert from 'node:assert/strict';import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {Pool} from 'pg';
if(!process.env.TEST_DATABASE_URL||process.env.TEST_DATABASE_CONFIRM_ISOLATED!=='yes')throw Error('Set TEST_DATABASE_URL and TEST_DATABASE_CONFIRM_ISOLATED=yes for a new isolated test database.');
const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL}),dir=mkdtempSync(join(tmpdir(),'pp-pg-'));let app;
try{
 const existing=(await pool.query("SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema='public'")).rows[0];assert.equal(Number(existing.count),0,'Use a fresh isolated database');
 process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;process.env.CLOUD_CONFIG=join(dir,'config.json');process.env.ALLOW_LEGACY_TOKENS='false';delete process.env.ADMIN_EMAIL;delete process.env.ADMIN_PASSWORD;
 writeFileSync(process.env.CLOUD_CONFIG,JSON.stringify({restaurants:[{id:'pg-r1',tenant_id:'pg-test',name:'PG test',currency:'BHD',timezone:'Asia/Bahrain',key:'postgres-test-key-at-least-32-characters'}]}));
 const {start}=await import('../cloud/server.mjs');app=await start(0);const second=await (await import('../cloud/store.mjs')).openStore();try{
 const x=await app.store.administration.load(),y=await second.administration.load();x.config.restaurants[0].active=false;await app.store.administration.save(x.config,x.version);await assert.rejects(()=>second.administration.save(y.config,y.version),e=>e.status===409);assert.equal((await second.administration.load()).config.restaurants[0].active,false);
 const p={day:'2026-10-01',sequence:2,reports:{transaction_summary:[],transaction_detail:[],product:[],sales_type:[]}};assert.equal(await app.store.put('pg-r1',p),true);assert.equal(await second.put('pg-r1',p),false);assert.equal(await second.put('pg-r1',{...p,sequence:1}),false);assert.equal((await second.get(['pg-r1'],p.day,p.day)).length,1);
 const before=await second.administration.load();const broken=structuredClone(before.config);broken.restaurants[0].name=null;await assert.rejects(()=>second.administration.save(broken,before.version));assert.equal((await second.administration.load()).version,before.version);
 await app.close();app=await start(0);assert.equal((await app.store.administration.load()).config.restaurants[0].active,false);assert.equal((await app.store.connectorStates(['pg-r1']))[0].sequence,2);
 }finally{await second.close();}console.log('POSTGRESQL INTEGRATION PASSED: migration, conflicts, cross-instance reads, rollback, snapshot replay and restart.');
}finally{if(app)await app.close();await pool.end();rmSync(dir,{recursive:true,force:true});}
