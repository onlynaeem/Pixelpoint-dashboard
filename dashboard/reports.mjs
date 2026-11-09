export const names={daily:'Daily sales',category:'Sales by category',tax:'Tax report',discount:'Discount report',product:'Sales by product',employee:'Sales by employee',void:'Void report',type:'Sales by order type',hourly:'Hourly sales',transactions:'Transaction register'};
export const shift=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export function localDay(zone='Asia/Bahrain'){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));return p.year+'-'+p.month+'-'+p.day;}
const num=v=>Number.isFinite(Number(v))?Number(v):0;
export function aggregate(rows,key,fields){const m=new Map();for(const row of rows){const k=String(key(row));if(!m.has(k))m.set(k,Object.fromEntries(Object.keys(fields).map(f=>[f,0])));for(const [f,fn]of Object.entries(fields))m.get(k)[f]+=num(fn(row));}return [...m].map(([Name,v])=>({Name,...v}));}
export function calculate(ss){
const h=ss.flatMap(s=>(s.reports.transaction_summary||[]).map(r=>({...r,Day:s.day,Branch:s.restaurant_id}))),p=ss.flatMap(s=>s.reports.product||[]),tax=r=>[1,2,3,4,5].reduce((a,i)=>a+num(r['Tax'+i]),0),metrics={Checks:()=>1,Net:r=>r['Net Total'],Tax:tax,Gross:r=>r['Final Total']};
const optional=k=>ss.length>0&&ss.every(s=>Array.isArray(s.reports[k])),extra=k=>ss.flatMap(s=>(s.reports[k]||[]).map(r=>({...r,Day:s.day,Branch:s.restaurant_id})));
const reports={
daily:{rows:aggregate(h,r=>r.Day,metrics).sort((a,b)=>a.Name.localeCompare(b.Name)),note:'Closed checks by local OPENDATE.'},
category:{rows:aggregate(extra('category'),r=>r.Category,{Quantity:r=>r.Quantity,Value:r=>r.Value}).sort((a,b)=>b.Value-a.Value),available:optional('category'),note:'Requires category mapping. Value follows source product-value semantics.'},
tax:{rows:aggregate(h,r=>r.Day,{Net:r=>r['Net Total'],...Object.fromEntries([1,2,3,4,5].map(i=>['Tax'+i,r=>r['Tax'+i]])),Tax:tax,Gross:r=>r['Final Total']}),note:'Original Tax1?Tax5 fields; tax rates are not assumed.'},
discount:{rows:extra('discount'),available:optional('discount'),note:'Requires applied discount amount, reason and employee. Coupon lines alone are insufficient.'},
product:{rows:aggregate(p,r=>(r['Product ID']??'')+' | '+(r.Product||'Unnamed'),{Quantity:r=>r.Quantity,Value:r=>r.Value}).sort((a,b)=>b.Value-a.Value),note:'Source Value = QUAN ? COSTEACH; not verified product net revenue or profit.'},
employee:{rows:aggregate(h,r=>r['Who Close']||'Unknown',metrics).sort((a,b)=>b.Net-a.Net),available:h.length>0&&h.every(r=>r['Who Close']!=null),note:'Sales attributed to the employee closing the check (Who Close).'},
void:{rows:extra('void'),available:optional('void'),note:'Requires a dedicated void query. Closed-sale queries cannot establish void totals.'},
type:{rows:aggregate(ss.flatMap(s=>s.reports.sales_type||[]),r=>r['Sales Type'],{Net:r=>r['Net Total'],Tax:tax,Gross:r=>r['Final Total']}).sort((a,b)=>b.Net-a.Net),note:'Supplied sales-type query.'},
hourly:{rows:aggregate(h,r=>{const t=String(r['Time Close']||'');const v=t.includes('T')?t.split('T')[1]:t;return /^\d{2}:/.test(v)?v.slice(0,2)+':00':'Unknown';},metrics).sort((a,b)=>a.Name.localeCompare(b.Name)),available:h.length>0&&h.every(r=>r['Time Close']!=null),note:'Local closing hour; dates follow OPENDATE.'},
transactions:{rows:h,note:'Original summary fields, branch and source day.'}};
return {reports,totals:{Checks:h.length,Net:h.reduce((a,r)=>a+num(r['Net Total']),0),Tax:h.reduce((a,r)=>a+tax(r),0),Gross:h.reduce((a,r)=>a+num(r['Final Total']),0)},branches:aggregate(h,r=>r.Branch,metrics)};
}
export function compare(a,b,complete=true){return !complete?'Comparison unavailable':b===0?(a===0?'No sales on either day':'No previous sales baseline'):(a>=b?'+':'')+((a-b)/b*100).toFixed(1)+'% vs yesterday';}
export function demo(today=localDay()){
const restaurants=['Manama Central','Seef Branch','Riyadh Restaurant','Lahore Restaurant','Dubai Restaurant','Kuwait Restaurant'].map((name,i)=>({id:'r'+(i+1),name,country:['BH','BH','SA','PK','AE','KW'][i],currency:['BHD','BHD','SAR','PKR','AED','KWD'][i],timezone:['Asia/Bahrain','Asia/Bahrain','Asia/Riyadh','Asia/Karachi','Asia/Dubai','Asia/Kuwait'][i]})),snapshots=[];
const menu=[['Espresso','Coffee',1.4],['Cappuccino','Coffee',2.2],['Latte','Coffee',2.4],['Iced Americano','Coffee',1.9],['Flat White','Coffee',2.3],['Club Sandwich','Food',3.9],['Chicken Wrap','Food',3.2],['Caesar Salad','Food',3.5],['Croissant','Bakery',1.6],['Chocolate Cake','Bakery',2.8],['Fresh Orange','Drinks',2.3],['Lemon Mint','Drinks',2.5]];
restaurants.forEach((branch,b)=>{for(let d=0;d<35;d++){
const day=shift(today,-d),h=[],p=[];
menu.forEach(([Product,Category,price],i)=>{const Quantity=8+(i*7+d*3+b*5)%23,Value=+(Quantity*price).toFixed(3);p.push({'Product ID':i+1,Product,Category,Quantity,Value});
for(let j=0;j<4;j++){const net=+(Value/4).toFixed(b===2?2:3),tx=b===2?Math.round(net*15)/100:+(net*.1).toFixed(3);h.push({'Transaction #':day+'-'+b+'-'+i+'-'+j,'Open Date':day,'Sales Type':['Dine In','Takeaway','Delivery'][(i+j)%3],'Who Close':['Ali Hassan','Sara Ahmed','Omar Khalid'][(i+j+b)%3],'Time Close':String(9+(i+j)%13).padStart(2,'0')+':35:00','Net Total':net,Tax1:tx,Tax2:0,Tax3:0,Tax4:0,Tax5:0,'Final Total':+(net+tx).toFixed(3)});}});
h.forEach(r=>r['Invoice Timestamp']=day+'T'+r['Time Close']+'+03:00');
const types=aggregate(h,r=>r['Sales Type'],{Net:r=>r['Net Total'],Tax:r=>r.Tax1,Gross:r=>r['Final Total']}).map(r=>({'Sales Type':r.Name,'Net Total':r.Net,Tax1:r.Tax,'Final Total':r.Gross}));
snapshots.push({restaurant_id:branch.id,day,reports:{payment:h.flatMap((r,i)=>{const total=Number(r['Final Total']);if(i%5===0){const cash=Number((total*.4).toFixed(branch.country==='SA'?2:3));return [{'Transaction #':r['Transaction #'],'Payment Type':'Cash',Amount:cash},{'Transaction #':r['Transaction #'],'Payment Type':'Card',Amount:Number((total-cash).toFixed(branch.country==='SA'?2:3))}];}return [{'Transaction #':r['Transaction #'],'Payment Type':['Cash','Card','BenefitPay','Online payment'][i%4],Amount:total}];}),transaction_summary:h,transaction_detail:h.map(row=>{const i=Number(row['Transaction #'].split('-').at(-2));return {'Transaction #':row['Transaction #'],RecPos:1,Product:menu[i][0],'POSDetail QUAN':1,'Cost Each':row['Net Total'],Value:row['Net Total'],'Line Description':'Demo check portion'};}),product:p.map(({Category,...r})=>r),sales_type:types,category:aggregate(p,r=>r.Category,{Quantity:r=>r.Quantity,Value:r=>r.Value}).map(({Name,...r})=>({Category:Name,...r})),discount:d%3?[{'Transaction #':h[0]['Transaction #'],Employee:'Ali Hassan',Reason:'Loyalty offer','Discount amount':3+b+d*.2}]:[],void:d%4===0?[{'Transaction #':'V-'+day,Product:'Latte',Employee:'Sara Ahmed',Reason:'Duplicate order',Quantity:1,'Void amount':2.4}]:[]}});}});
return {restaurants,snapshots};}


export function transactionCopy(snapshots,restaurantId,day,id){
 const s=snapshots.find(s=>s.restaurant_id===restaurantId&&s.day===day);
 const header=s?.reports.transaction_summary?.find(r=>String(r['Transaction #'])===String(id));
 if(!header)return null;
 return {header,lines:(s.reports.transaction_detail||[]).filter(r=>String(r['Transaction #'])===String(id)).sort((a,b)=>Number(a.RecPos)-Number(b.RecPos))};
}


// Payment totals represent settled tender allocations, not net product sales.
export function paymentSummary(snapshots){
 const available=snapshots.length>0&&snapshots.every(s=>Array.isArray(s.reports.payment));
 if(!available)return {available:false,rows:[],total:0};
 const rows=aggregate(snapshots.flatMap(s=>s.reports.payment),r=>r['Payment Type']||'Unspecified',{Amount:r=>r.Amount,Allocations:()=>1}).sort((a,b)=>b.Amount-a.Amount);
 return {available:true,rows,total:rows.reduce((a,r)=>a+r.Amount,0)};
}
export function customerStorageKey(mode,branch,day,id){return 'pixelpoint-customer-'+JSON.stringify([mode,branch,day,String(id)]);}
