import {planDays} from '../connector/sync-plan.mjs';
export function milli(value){
 if(!['string','number'].includes(typeof value)||!/^[-+]?\d+(\.\d+)?$/.test(String(value)))throw Error('Amounts must be plain decimal numbers.');
 const negative=String(value).startsWith('-'),[whole,fraction='']=String(value).replace(/^[-+]/,'').split('.');
 let n=BigInt(whole)*1000n+BigInt((fraction+'000').slice(0,3));if(Number(fraction[3]||0)>=5)n++;
 if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Amount exceeds supported range.');return Number(negative?-n:n);
}
export function reconcile(snapshots,input){
 const {from,to,expected}=input;const days=planDays(to,1,{from,to});
 if(!Array.isArray(expected)||expected.length>366)throw Error('Supply up to 366 reference rows.');
 if(input.tolerance!==undefined&&(Number(input.tolerance)<0||Number(input.tolerance)>1000))throw Error('Tolerance must be between 0 and 1000.');
 const tolerance=input.tolerance===undefined?1:milli(input.tolerance);if(tolerance<0||tolerance>1000000)throw Error('Tolerance must be between 0 and 1000.');
 const refs=new Map();for(const row of expected){if(!row||!days.includes(row.day)||refs.has(row.day))throw Error('Reference days must be unique and inside the date range.');const ref={};for(const key of ['net','tax','gross'])ref[key]=milli(row[key]);if(!Number.isSafeInteger(row.transactions)||row.transactions<0)throw Error('Reference transaction count must be a nonnegative whole number.');ref.transactions=row.transactions;refs.set(row.day,ref);}
 const source=new Map(snapshots.map(s=>[s.day,s]));
 const rows=days.map(day=>{const ref=refs.get(day),snapshot=source.get(day);let actual=null;
 if(snapshot){const totals={net:0,tax:0,gross:0,transactions:0};for(const r of snapshot.reports.transaction_summary){totals.net+=milli(r['Net Total']);totals.gross+=milli(r['Final Total']);totals.tax+=['Tax1','Tax2','Tax3','Tax4','Tax5'].reduce((sum,k)=>sum+milli(r[k]??0),0);totals.transactions++;}if(Object.values(totals).some(n=>!Number.isSafeInteger(n)))throw Error('Totals exceed supported range.');actual=totals;}
 const difference=actual&&ref?Object.fromEntries(Object.keys(actual).map(k=>[k,actual[k]-ref[k]])):null;
 if(difference&&Object.values(difference).some(n=>!Number.isSafeInteger(n)))throw Error('Differences exceed supported range.');
 const status=!snapshot?'missing_source':!ref?'missing_reference':Object.entries(difference).every(([k,n])=>Math.abs(n)<=(k==='transactions'?0:tolerance))?'match':'mismatch';
 const money=values=>values?Object.fromEntries(Object.entries(values).map(([k,v])=>[k,k==='transactions'?v:v/1000])):null;
 return {day,status,actual:money(actual),expected:money(ref),difference:money(difference),received_at:snapshot?.received_at||null};});
 return {from,to,tolerance:tolerance/1000,rounding:'Amounts rounded to three decimals per source field, half away from zero; transaction counts exact.',passed:rows.every(r=>r.status==='match'),rows};
}
