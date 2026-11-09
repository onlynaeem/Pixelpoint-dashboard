// Explicit opt-in: use an isolated test DB, never a production DB.
import assert from 'node:assert/strict';
if(!process.env.TEST_DATABASE_URL)throw Error('Set TEST_DATABASE_URL to an isolated PostgreSQL test database');
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
const {openStore}=await import('../cloud/store.mjs');const s=await openStore();
const id='test-'+Date.now();try{
await s.seed({id,tenant_id:'test',name:'Test',currency:'BHD',timezone:'Asia/Bahrain',key_hash:'test'});
const p={day:'2026-10-26',sequence:2,reports:{transaction_summary:[],transaction_detail:[],product:[],sales_type:[]}};
assert.equal(await s.put(id,p),true);assert.equal(await s.put(id,p),false);assert.equal(await s.put(id,{...p,sequence:1}),false);assert.equal((await s.get([id],p.day,p.day)).length,1);
console.log('PostgreSQL smoke test passed; test restaurant retained:',id);
}finally{await s.close();}
