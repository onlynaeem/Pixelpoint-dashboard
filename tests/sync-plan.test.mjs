import {test} from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {parseRange,planDays,validateSync,defaultSync} from '../connector/sync-plan.mjs';
test('backfill includes leap-day bounds and rejects future, impossible or excessive dates',()=>{
 assert.deepEqual(planDays('2024-03-01',1,{from:'2024-02-28',to:'2024-03-01'}),['2024-02-28','2024-02-29','2024-03-01']);
 assert.deepEqual(planDays('2026-01-01',2),['2025-12-31','2026-01-01']);
 for(const range of [{from:'2026-02-30',to:'2026-03-01'},{from:'2026-11-10',to:'2026-11-11'},{from:'2026-03-01',to:'2026-02-28'},{from:'2020-01-01',to:'2026-01-01'}])assert.throws(()=>planDays('2026-11-09',8,range));
});
test('backfill arguments require explicit one-shot dates; settings are bounded and drop untrusted fields',()=>{
 assert.equal(parseRange([]),null);assert.deepEqual(parseRange(['--from','2026-01-01','--to','2026-01-02','--once']),{from:'2026-01-01',to:'2026-01-02'});
 for(const args of [['--from','2026-01-01'],['--from','--to','2026-01-01','--once'],['--from','x','--from','y','--to','z','--once']])assert.throws(()=>parseRange(args));
 assert.deepEqual(validateSync({...defaultSync,key:'hidden'}),defaultSync);
 for(const change of [{mode:'bad'},{interval_seconds:29},{interval_seconds:86401},{daily_at:'24:00'},{lookback_days:367},{lookback_days:1.5}])assert.throws(()=>validateSync({...defaultSync,...change}));
});
test('agent plan runs without API key, database credentials or network connection',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pp-plan-'));try{const path=join(dir,'connector.json');writeFileSync(path,JSON.stringify({...defaultSync,restaurant_id:'test',timezone:'Asia/Bahrain',api_url:'https://example.invalid',key_env:'UNSET_PLAN_KEY'}));const env={...process.env,CONNECTOR_CONFIG:path};delete env.UNSET_PLAN_KEY;delete env.PIXELPOINT_ODBC;const child=spawnSync(process.execPath,['connector/agent.mjs','--from','2024-02-28','--to','2024-03-01','--once','--plan'],{encoding:'utf8',env,windowsHide:true});assert.equal(child.status,0,child.stderr);assert.equal(JSON.parse(child.stdout).days.length,3);}finally{rmSync(dir,{recursive:true,force:true});}
});
