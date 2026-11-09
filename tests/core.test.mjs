import {test} from 'node:test';import assert from 'node:assert/strict';import {validate,summarize} from '../cloud/core.mjs';
const p={day:'2026-10-26',sequence:1,reports:{transaction_summary:[{'Transaction #':1,'Net Total':'10','Final Total':'11',Tax1:1,Tax2:0,Tax3:0,Tax4:0,Tax5:0}],transaction_detail:[],product:[],sales_type:[]}};
test('monetary strings from ODBC aggregate numerically',()=>{validate(p);assert.equal(summarize([p]).totals.net,10);assert.equal(summarize([p]).totals.tax,1);});
test('partial snapshots rejected',()=>assert.throws(()=>validate({...p,reports:{}})));
test('duplicate transactions rejected',()=>assert.throws(()=>validate({...p,reports:{...p.reports,transaction_summary:[...p.reports.transaction_summary,...p.reports.transaction_summary]}})));
test('non-finite amounts rejected',()=>assert.throws(()=>validate({...p,reports:{...p.reports,transaction_summary:[{'Net Total':'bad'}]}})));
