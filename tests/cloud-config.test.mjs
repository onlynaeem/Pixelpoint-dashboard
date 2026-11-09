import {test} from 'node:test';import assert from 'node:assert/strict';import {checkConfig} from '../scripts/check-cloud-config.mjs';
test('cloud preflight rejects demo credentials and unsafe settings without exposing secrets',()=>{
 const key='demo-key-change-me-123456789012345';const issues=checkConfig({restaurants:[{id:'a',name:'A',tenant_id:'t',currency:'BHD',timezone:'Asia/Bahrain',key}]},{DEMO:'true',SESSION_SECURE:'false'});assert.ok(issues.length>=4);assert.ok(!JSON.stringify(issues).includes(key));
 const valid={restaurants:[{id:'a',name:'A',tenant_id:'t',currency:'BHD',timezone:'Asia/Bahrain',key:'x'.repeat(40)}]};assert.deepEqual(checkConfig(valid,{DATABASE_URL:'postgresql://localhost/reporting'}),[]);assert.ok(checkConfig({restaurants:[...valid.restaurants,...valid.restaurants]},{DATABASE_URL:'postgresql://localhost/reporting'}).length>=2);
});
