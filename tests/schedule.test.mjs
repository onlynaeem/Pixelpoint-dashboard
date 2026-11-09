import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSchedule} from '../scripts/sync-schedule.mjs';
const config={mode:'interval',interval_seconds:60,timezone:'Asia/Bahrain'};
test('interval refresh waits after each attempt including failure',()=>{
 const s=createSchedule(config);assert.equal(s.due(0),true);s.attempted(0);
 assert.equal(s.due(59999),false);assert.equal(s.due(60000),true);
 s.attempted(60000);s.succeeded(65000);assert.equal(s.due(119999),false);assert.equal(s.due(120000),true);
});
test('daily schedule uses restaurant timezone, retries failure, runs again next day',()=>{
 const s=createSchedule({...config,mode:'daily',daily_at:'02:00'});
 const t=Date.parse('2026-11-09T23:00:00Z');
 assert.equal(s.due(t-1),false);assert.equal(s.due(t),true);s.attempted(t);
 assert.equal(s.due(t+59999),false);assert.equal(s.due(t+60000),true);
 s.succeeded(t+60000);assert.equal(s.due(t+3600000),false);assert.equal(s.due(t+86400000),true);
});
test('invalid schedules fail before synchronization',()=>{
 for(const c of [{mode:'invalid'},{interval_seconds:1},{mode:'daily',daily_at:'25:00'},{timezone:'Invalid/Zone'}]) assert.throws(()=>createSchedule({...config,...c}));
});
