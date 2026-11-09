import {test} from 'node:test';import assert from 'node:assert/strict';import {reconcile,milli} from '../cloud/reconcile.mjs';import {referenceRows,reconciliationCSV} from '../dashboard/reconciliation-ui.js';
const empty=day=>({day,reports:{transaction_summary:[]}}),input={from:'2026-10-01',to:'2026-10-01',expected:[{day:'2026-10-01',net:'0',tax:'0',gross:'0',transactions:0}]};
test('missing source and reference cannot match zero; uploaded empty day can',()=>{assert.equal(reconcile([],input).rows[0].status,'missing_source');assert.equal(reconcile([empty(input.from)],{...input,expected:[]}).rows[0].status,'missing_reference');assert.equal(reconcile([empty(input.from)],input).passed,true);});
test('decimal rounding, tolerance boundaries, negative values and exact counts',()=>{
 assert.equal(milli('1.2345'),1235);assert.equal(milli('-1.2345'),-1235);assert.equal(milli('0.001'),1);
 const snapshot=empty(input.from);snapshot.reports.transaction_summary=[{'Net Total':'1.001','Final Total':'1.101',Tax1:'.1'}];snapshot.reports.transaction_summary[0].Tax1='0.100';
 const ref={...input,expected:[{day:input.from,net:'1.000',tax:'0.100',gross:'1.100',transactions:1}]};assert.equal(reconcile([snapshot],ref).passed,true);assert.equal(reconcile([snapshot],{...ref,tolerance:0}).passed,false);assert.equal(reconcile([snapshot],{...ref,tolerance:1000,expected:[{...ref.expected[0],transactions:2}]}).passed,false);
});
test('reference validation rejects duplicates, invalid dates, non-numbers and excessive ranges',()=>{
 for(const change of [{expected:[...input.expected,...input.expected]},{to:'2026-02-30'},{to:'2028-10-01'},{tolerance:-1},{tolerance:1001},{expected:[{...input.expected[0],net:null}]},{expected:[{...input.expected[0],transactions:0.5}]},{expected:[{...input.expected[0],day:'2026-10-02'}]}])assert.throws(()=>reconcile([], {...input,...change}));
 for(const n of [null,'','1e3','Infinity',NaN,'9007199254740991000'])assert.throws(()=>milli(n));
 for(const tolerance of ['-0.0001','1000.0001'])assert.throws(()=>reconcile([],{...input,tolerance}));
});
test('CSV entry parsing and comparison export preserve differences and neutralize formulas',()=>{
 const rows=referenceRows('day,net,tax,gross,transactions\n2026-10-01,0,0,0,0');assert.equal(rows[0].transactions,0);assert.throws(()=>referenceRows('date,net,tax,gross,transactions'));assert.throws(()=>referenceRows('day,net,tax,gross,transactions\n2026-10-01,0,0,0,NaN'));
 const data={...reconcile([empty(input.from)],input),restaurant_id:' =HYPERLINK("x")',currency:'BHD'};const csv=reconciliationCSV(data);assert.ok(csv.includes('" \'=HYPERLINK'));assert.ok(csv.includes('difference_transactions'));assert.ok(csv.includes('match'));
});
