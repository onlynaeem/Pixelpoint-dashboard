import {createHash,timingSafeEqual} from 'node:crypto';
export const reports=['transaction_summary','transaction_detail','product','sales_type'];
export const hash=s=>createHash('sha256').update(s).digest('hex');
export function equal(a,b){const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);}
export function validate(p){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(p.day)||isNaN(Date.parse(p.day))||new Date(p.day).toISOString().slice(0,10)!==p.day)throw Error('Invalid day');
 if(!Number.isSafeInteger(p.sequence)||p.sequence<1)throw Error('Invalid sequence');
 if(!p.reports||reports.some(r=>!Array.isArray(p.reports[r])))throw Error('All four reports required');
 for(const r of reports){if(p.reports[r].length>100000)throw Error('Too many rows');
 for(const row of p.reports[r]){if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Invalid row');}}
 for(const row of p.reports.transaction_summary)for(const k of ['Net Total','Final Total','Tax1','Tax2','Tax3','Tax4','Tax5'])if(!Number.isFinite(Number(row[k])))throw Error('Invalid monetary value');
 const ids=p.reports.transaction_summary.map(r=>String(r['Transaction #']));
 if(p.reports.transaction_summary.some(r=>r['Transaction #']==null))throw Error('Missing transaction ID');
 if(new Set(ids).size!==ids.length)throw Error('Duplicate transaction');
 const optional={payment:{required:['Transaction #','Payment Type'],amounts:['Amount']},category:{required:['Category'],amounts:['Quantity','Value']},void:{required:['Transaction #','Product','Employee','Reason'],amounts:['Quantity','Void amount']},discount:{required:['Transaction #','Employee','Reason'],amounts:['Discount amount']}};
 for(const [name,rule]of Object.entries(optional)){if(p.reports[name]===undefined)continue;const rows=p.reports[name];if(!Array.isArray(rows)||rows.length>100000)throw Error('Invalid optional report '+name);for(const row of rows){if(!row||rule.required.some(k=>row[k]===null||row[k]===undefined||!['string','number'].includes(typeof row[k]))||rule.amounts.some(k=>!['string','number'].includes(typeof row[k])||String(row[k]).trim()===''||!Number.isFinite(Number(row[k]))))throw Error('Invalid optional report row '+name);}}
}
export function summarize(snapshots){
 const totals={net:0,tax:0,gross:0,transactions:0};const daily=Object.create(null),types=Object.create(null),products=Object.create(null);
 for(const s of snapshots){for(const r of s.reports.transaction_summary){
 const n=Number(r['Net Total']),g=Number(r['Final Total']);totals.net+=n;totals.gross+=g;totals.transactions++;
 totals.tax+=['Tax1','Tax2','Tax3','Tax4','Tax5'].reduce((a,k)=>a+Number(r[k]||0),0);
 daily[s.day]=(daily[s.day]||0)+n;}
 for(const r of s.reports.sales_type)types[r['Sales Type']]=(types[r['Sales Type']]||0)+Number(r['Net Total']);
 for(const r of s.reports.product){const k=r.Product||'(Unnamed)';products[k]=(products[k]||0)+Number(r.Value);}}
 return {totals,daily,types,products};
}

