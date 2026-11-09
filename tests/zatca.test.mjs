import {test} from 'node:test';import assert from 'node:assert/strict';import {phase1Payload} from '../dashboard/zatca.mjs';
const fields={seller:'Bobs Records',vat:'310122393500003',timestamp:'2022-04-25T15:30:00Z',total:1000,tax:150};
test('Phase 1 matches official ZATCA example exactly',()=>assert.equal(phase1Payload(fields),'AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQxNTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA=='));
test('Arabic seller TLV length uses UTF-8 bytes',()=>{const seller='���� ����';const bytes=Buffer.from(phase1Payload({...fields,seller}),'base64');assert.equal(bytes[0],1);assert.equal(bytes[1],Buffer.byteLength(seller));assert.equal(bytes.subarray(2,2+bytes[1]).toString('utf8'),seller);let at=0,tags=[];while(at<bytes.length){tags.push(bytes[at]);at+=2+bytes[at+1];}assert.deepEqual(tags,[1,2,3,4,5]);assert.equal(at,bytes.length);});
test('Invalid seller VAT, missing original timestamp and impossible totals rejected',()=>{for(const bad of [{vat:''},{vat:'BH12345'},{timestamp:''},{timestamp:'2026-10-26T12:00:00'},{total:-1},{tax:1001},{seller:'a'.repeat(256)}])assert.throws(()=>phase1Payload({...fields,...bad}));});

