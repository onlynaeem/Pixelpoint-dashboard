import {initAccess} from './auth-ui.js';
import {phase1Payload} from './zatca.mjs';
import {names,calculate,demo,compare,localDay,shift,transactionCopy,paymentSummary,customerStorageKey} from './reports.mjs';
const $=id=>document.getElementById(id),sample=demo(),money=(n,c=document.getElementById('currency')?.value||'BHD')=>{const d=['BHD','KWD'].includes(c)?3:2;return Number(n).toLocaleString('en-BH',{minimumFractionDigits:d,maximumFractionDigits:d});};
let access=null,currentAccount=null;
let restaurants=sample.restaurants,source=sample.snapshots,mode='demo',active='overview',result,rows=[],page=0,sort='',asc=true,requestId=0,today=localDay();
const el=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;};
$('to').value=today;$('from').value=shift(today,-6);
function options(){const country=$('country'),oldCountry=country.value,old=$('restaurant').value;const labels={BH:'Bahrain',SA:'Saudi Arabia',PK:'Pakistan',AE:'United Arab Emirates',KW:'Kuwait'};const countries=[...new Set(restaurants.map(r=>r.country).filter(Boolean))].sort();country.replaceChildren(new Option('All assigned countries',''),...countries.map(c=>new Option(labels[c]||c,c)));if(countries.includes(oldCountry))country.value=oldCountry;const available=restaurants.filter(r=>!country.value||r.country===country.value);$('restaurant').replaceChildren(new Option('All assigned restaurants',''),...available.map(r=>new Option(r.name+' ('+r.currency+')',r.id)));if(available.some(r=>r.id===old))$('restaurant').value=old;}options();const requestedBranch=new URLSearchParams(location.search).get('restaurant');if(restaurants.some(r=>r.id===requestedBranch))$('restaurant').value=requestedBranch;
for(const [key,name]of Object.entries(names)){const b=el('button',name,'nav');b.onclick=()=>show(key);$('reportnav').append(b);}
function show(key){active=key;$('title').textContent=names[key]||'Sales overview';$('dashboard').hidden=key!=='overview';$('reportPanel').hidden=key==='overview';document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.textContent===(names[key]||'Overview')));page=0;sort='';$('search').value='';renderReport();}$('overview').onclick=()=>show('overview');
async function api(path){if(access)return access.request(path);const response=await fetch(path,{credentials:'same-origin'});const data=await response.json();if(!response.ok)throw Error(data.error||'Sign in required');return data;}
function table(target,data){target.replaceChildren();if(!data.length){target.append(el('p','No records for these filters.','empty'));return;}const keys=[...new Set(data.flatMap(Object.keys))],t=document.createElement('table'),h=t.createTHead().insertRow();keys.forEach(k=>h.append(el('th',k)));const body=t.createTBody();for(const row of data){const tr=body.insertRow();keys.forEach(k=>{const cell=tr.insertCell();if(k==='Transaction #'&&row['Branch ID']){const b=el('button',row[k],'transaction-link');b.type='button';b.onclick=()=>openTransaction(row);cell.append(b);}else cell.textContent=typeof row[k]==='number'?(Number.isInteger(row[k])?row[k]:money(row[k],row.Currency)):row[k]??'';});}target.append(t);}
function bars(id,items){const target=$(id);target.replaceChildren();if(!items.length){target.append(el('p','Data unavailable for this selection.','empty'));return;}const max=Math.max(1,...items.map(x=>x[1]));for(const [name,value]of items){const row=el('div','','bar'),label=el('div','','bar-label'),track=el('div','','track'),fill=el('div','','fill');label.append(el('span',name),el('b',money(value)));fill.style.width=Math.max(0,value/max*100)+'%';track.append(fill);row.append(label,track);target.append(row);}}
function trend(data){$('trend').replaceChildren();if(!data.length){$('trend').append(el('p','No daily data.','empty'));return;}const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 720 235');svg.setAttribute('role','img');svg.setAttribute('aria-label','Daily net sales trend');
const max=Math.max(1,...data.map(r=>r.Net)),x=i=>55+i*625/Math.max(1,data.length-1),y=v=>190-v/max*155;
for(let i=0;i<4;i++){const v=max*i/3,line=document.createElementNS(ns,'line');for(const [k,value]of Object.entries({x1:55,x2:700,y1:y(v),y2:y(v),stroke:'#eeeaf3'}))line.setAttribute(k,value);svg.append(line);const label=document.createElementNS(ns,'text');label.setAttribute('x',0);label.setAttribute('y',y(v)+4);label.textContent=v.toFixed(0);svg.append(label);}
const path=document.createElementNS(ns,'polyline');path.setAttribute('points',data.map((r,i)=>x(i)+','+y(r.Net)).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke','#9269b0');path.setAttribute('stroke-width',3);svg.append(path);
data.forEach((r,i)=>{const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',x(i));dot.setAttribute('cy',y(r.Net));dot.setAttribute('r',4);dot.setAttribute('fill','#9269b0');const title=document.createElementNS(ns,'title');title.textContent=r.Name+': '+money(r.Net);dot.append(title);svg.append(dot);if(data.length<9||i===0||i===data.length-1){const label=document.createElementNS(ns,'text');label.setAttribute('x',Math.min(655,x(i)-15));label.setAttribute('y',220);label.textContent=r.Name.slice(5);svg.append(label);}});$('trend').append(svg);}
async function refresh(){
 const req=++requestId;$('status').textContent='Loading...';$('csv').disabled=true;
 try{
 const selected=restaurants.filter(r=>(!$('restaurant').value||r.id===$('restaurant').value)&&(!$('country').value||r.country===$('country').value)),from=$('from').value,to=$('to').value;
 if(!from||!to||from>to)throw Error('Choose a valid date range.');if(Date.parse(to)-Date.parse(from)>365*86400000)throw Error('Choose at most 366 days.');
 const currencies=[...new Set(selected.map(r=>r.currency))].sort(),oldCurrency=$('currency').value;
 $('currency').replaceChildren(...currencies.map(c=>new Option(c+' - charts and reports',c)));$('currency').value=currencies.includes(oldCurrency)?oldCurrency:(currencies[0]||'');
 const currency=$('currency').value,chartStores=selected.filter(r=>r.currency===currency),ids=new Set(selected.map(r=>r.id)),chartIds=new Set(chartStores.map(r=>r.id));
 today=localDay(chartStores[0]?.timezone||'Asia/Bahrain');const yesterday=shift(today,-1);
 let snapshots=source;
 if(mode==='api'){const [a,b]=await Promise.all([api('/api/report?'+new URLSearchParams({restaurant:$('restaurant').value,country:$('country').value,from,to})),api('/api/report?'+new URLSearchParams({restaurant:$('restaurant').value,country:$('country').value,from:yesterday,to:today}))]);snapshots=[...a.snapshots,...b.snapshots.filter(s=>s.day<from||s.day>to)];}
 if(req!==requestId)return;
 const allScoped=snapshots.filter(s=>ids.has(s.restaurant_id)),allRange=allScoped.filter(s=>s.day>=from&&s.day<=to),scoped=allScoped.filter(s=>chartIds.has(s.restaurant_id)),filtered=scoped.filter(s=>s.day>=from&&s.day<=to);
 visibleSnapshots=filtered;result=calculate(filtered);
 $('brandSummary').replaceChildren();
 for(const c of currencies){
 const branches=selected.filter(r=>r.currency===c),cids=new Set(branches.map(r=>r.id)),group=allRange.filter(s=>cids.has(s.restaurant_id)),totals=calculate(group).totals,card=el('div','','brand-total');
 card.append(el('span',c+' / '+branches.length+' restaurant'+(branches.length===1?'':'s')),el('strong',group.length?money(totals.Net,c)+' '+c:'No data'),el('small','Net sales / selected dates'),el('p',totals.Checks+' closed checks / '+group.length+' daily snapshots'));
 $('brandSummary').append(card);}
 const a=calculate(scoped.filter(s=>s.day===today)).totals,b=calculate(scoped.filter(s=>s.day===yesterday)).totals;
 const complete=chartStores.length>0&&new Set(chartStores.map(r=>r.timezone)).size===1&&chartStores.every(r=>[today,yesterday].every(d=>scoped.some(s=>s.restaurant_id===r.id&&s.day===d)));
 $('comparisonLabel').textContent=currency+' / '+chartStores.length+' store(s) / '+today+' vs '+yesterday+' / '+(chartStores[0]?.timezone||'');$('cards').replaceChildren();
 for(const [k,label]of [['Net','Net sales today'],['Gross','Gross sales today'],['Checks','Closed checks today'],['Average','Average net check']]){
 const current=k==='Average'?(a.Checks?a.Net/a.Checks:0):a[k],previous=k==='Average'?(b.Checks?b.Net/b.Checks:0):b[k],card=el('div','','card');
 card.append(el('div',label,'label'),el('strong',complete?(k==='Checks'?current:money(current)+' '+currency):'Unavailable'),el('small',compare(current,previous,complete),complete?(current>=previous?'positive':'negative'):'muted'));$('cards').append(card);}
 bars('compare',complete?[['Yesterday',b.Net],['Today - provisional',a.Net]]:[]);trend(result.reports.daily.rows);
 bars('products',result.reports.product.rows.slice(0,10).map(r=>[r.Name,r.Value]));
 bars('categories',result.reports.category.available?result.reports.category.rows.slice(0,10).map(r=>[r.Name,r.Value]):[]);
 if(!result.reports.category.available)$('categories').replaceChildren(el('p','Category mapping not connected.','empty'));
 bars('types',result.reports.type.rows.map(r=>[r.Name,r.Net]));
 table($('branches'),selected.map(r=>{const ss=allRange.filter(s=>s.restaurant_id===r.id),t=calculate(ss).totals;return {Branch:r.name,Currency:r.currency,Checks:ss.length?t.Checks:'No data',Net:ss.length?t.Net:'No data',Tax:ss.length?t.Tax:'No data',Gross:ss.length?t.Gross:'No data',Snapshots:ss.length};}));
 $('status').textContent=(mode==='demo'?'DEMO / ':'API / ')+selected.length+' selected store(s). All-store totals are separated by currency. Charts and reports: '+currency+' / '+chartStores.length+' store(s) / '+from+' to '+to+'.';
 renderReport();enhanceWidgets();moreWidgets();
 }catch(e){if(req!==requestId)return;result=null;rows=[];document.getElementById('insight')?.remove();for(const id of ['brandSummary','cards','trend','compare','products','categories','types','payments','hourlyWidget','employeeWidget','controlsWidget','taxWidget','branches','reportTable'])$(id).replaceChildren();$('status').textContent=e.message;$('csv').disabled=true;}
}
function renderReport(){if(active==='overview'||!result)return;const r=result.reports[active];$('reportTitle').textContent=names[active];$('reportNote').textContent=r.note;const search=$('search').value.toLowerCase();rows=r.available===false?[]:r.rows.map(row=>row.Branch?{...row,'Branch ID':row.Branch,Branch:restaurants.find(b=>b.id===row.Branch)?.name||row.Branch}:row).filter(row=>Object.values(row).some(v=>String(v).toLowerCase().includes(search)));
if(sort)rows.sort((a,b)=>(typeof a[sort]==='number'&&typeof b[sort]==='number'?a[sort]-b[sort]:String(a[sort]??'').localeCompare(String(b[sort]??'')))*(asc?1:-1));
const pages=Math.max(1,Math.ceil(rows.length/25));page=Math.min(page,pages-1);table($('reportTable'),rows.slice(page*25,page*25+25));if(r.available===false)$('reportTable').replaceChildren(el('p','Source fields are not connected for this report.','empty'));
$('reportTable').querySelectorAll('th').forEach(th=>{th.tabIndex=0;const fn=()=>{asc=sort===th.textContent?!asc:true;sort=th.textContent;renderReport();};th.onclick=fn;th.onkeydown=e=>{if(e.key==='Enter')fn();};});
$('rowcount').textContent=rows.length+' records';$('page').textContent=(page+1)+' / '+pages;$('prev').disabled=page===0;$('next').disabled=page>=pages-1;$('csv').disabled=!rows.length;}
$('filters').onsubmit=e=>{e.preventDefault();refresh();};$('week').onclick=()=>{$('from').value=shift(today,-6);$('to').value=today;refresh();};$('search').oninput=()=>{page=0;renderReport();};$('prev').onclick=()=>{page--;renderReport();};$('next').onclick=()=>{page++;renderReport();};
$('settingsOpen').onclick=()=>$('settings').showModal();$('closeSettings').onclick=()=>$('settings').close();$('useapi').onclick=()=>{$('settings').close();access.showLogin();};
$('usedemo').onclick=()=>{mode='demo';restaurants=sample.restaurants;source=sample.snapshots;options();$('badge').textContent='DEMO DATA';$('notice').textContent='Sample data for dashboard review. ODBC integration is deferred.';$('settings').close();refresh();};
$('csv').onclick=()=>{if(!rows.length)return;const keys=[...new Set(rows.flatMap(Object.keys))],cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"' $&").replaceAll('"','""')+'"',blob=new Blob(['\ufeff'+[keys,...rows.map(r=>keys.map(k=>r[k]))].map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=active+'-'+$('from').value+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

let visibleSnapshots=[];
const receiptDialog=document.createElement('dialog');receiptDialog.id='receiptDialog';receiptDialog.setAttribute('aria-label','Transaction copy');
const receiptToolbar=el('div','','receipt-toolbar'),printReceipt=el('button','Print / Save PDF'),closeReceipt=el('button','Close','secondary'),receiptBody=el('div','','receipt-body');
printReceipt.onclick=()=>{if(!updateSaudiQr())return;saveCustomerDetails();window.print();};closeReceipt.onclick=()=>receiptDialog.close();receiptToolbar.append(printReceipt,closeReceipt);receiptDialog.append(receiptToolbar,receiptBody);document.body.append(receiptDialog);
const profileButton=el('button','Restaurant details','secondary');profileButton.type='button';document.querySelector('.actions').append(profileButton);
const profileDialog=document.createElement('dialog');profileDialog.id='profileDialog';profileDialog.append(el('h2','Restaurant header and footer'),el('p','Demo details are saved in this browser. API mode requires a verified restaurant profile.','muted'));
const branchSelect=document.createElement('select'),profileFields={};profileDialog.append(branchSelect);
for(const [key,label]of Object.entries({name:'Restaurant name',address:'Address',phone:'Telephone',taxNumber:'Tax registration number',footer:'Receipt footer',country:'Country',nameAr:'Arabic restaurant name',addressAr:'Arabic address',footerAr:'Arabic footer'})){const l=el('label',label),input=document.createElement(key==='country'?'select':'input');if(key==='country')for(const [code,label]of Object.entries({BH:'Bahrain / BHD',SA:'Saudi Arabia / SAR',PK:'Pakistan / PKR',AE:'United Arab Emirates / AED',KW:'Kuwait / KWD'}))input.append(new Option(label,code));l.append(input);profileFields[key]=input;profileDialog.append(l);}
const saveProfile=el('button','Save details'),cancelProfile=el('button','Close','secondary');profileDialog.append(saveProfile,cancelProfile);document.body.append(profileDialog);
function profile(r){let saved={};if(mode==='demo')try{saved=JSON.parse(localStorage.getItem('pixelpoint-receipt-'+r.id)||'{}');}catch{}
return {country:r.country||'BH',nameAr:r.country==='SA'?'���� ���� �颤���':'',addressAr:r.country==='SA'?'���� ����� - ����':'',footerAr:r.country==='SA'?'�詟 ����':'',name:r.name,address:mode==='demo'?(r.country==='SA'?'Sample address - Riyadh':'Sample address - Bahrain'):'',phone:mode==='demo'?'Demo phone: not configured':'',taxNumber:mode==='demo'?(r.country==='SA'?'310122393500003':'DEMO - NOT A TAX REGISTRATION'):'',footer:'Thank you for your visit.',...(r.receipt||{}),...saved};}
function fillProfile(){const r=restaurants.find(r=>r.id===branchSelect.value);if(!r)return;const p=profile(r);for(const k in profileFields)profileFields[k].value=p[k]||'';}
profileButton.onclick=()=>{branchSelect.replaceChildren(...restaurants.map(r=>new Option(r.name,r.id)));branchSelect.value=$('restaurant').value||restaurants[0]?.id||'';saveProfile.disabled=mode!=='demo';fillProfile();profileDialog.showModal();};branchSelect.onchange=fillProfile;cancelProfile.onclick=()=>profileDialog.close();
saveProfile.onclick=()=>{try{localStorage.setItem('pixelpoint-receipt-'+branchSelect.value,JSON.stringify(Object.fromEntries(Object.entries(profileFields).map(([k,input])=>[k,input.value.trim()]))));profileDialog.close();}catch{alert('Browser storage is unavailable; details could not be saved.');}};
function openTransaction(row){
 customerState=null;saudiQrState=null;receiptBody.classList.remove('saudi-copy');printReceipt.disabled=true;saveCustomer.disabled=true;
 const copy=transactionCopy(visibleSnapshots,row['Branch ID'],row.Day,row['Transaction #']);receiptBody.replaceChildren();
 const r=restaurants.find(r=>r.id===row['Branch ID']);
 if(!copy||!r){receiptBody.append(el('p','No closed transaction header is available for this record. Void records require a separate source document.'));receiptDialog.showModal();return;}
 const p=profile(r),h=copy.header;receiptBody.append(el('h2',p.name),el('p',p.address),el('p',p.phone),el('p',p.taxNumber?'Tax registration: '+p.taxNumber:'Tax registration: not configured'),el('h3','TRANSACTION COPY'),el('p',mode==='demo'?'DEMO DATA - NOT A FISCAL RECEIPT':'Reporting copy - original fiscal receipt status not verified','muted'));
 printReceipt.disabled=false;saveCustomer.disabled=mode==='api'&&currentAccount?.role==='viewer';receiptBody.append(customerEditor(row,h));
 const info=el('div','','receipt-info');for(const [label,value]of Object.entries({'Transaction number':h['Transaction #'],Date:row.Day,Branch:r.name,'Order type':h['Sales Type'],'Table number':h['Table #'],'Closed by':h['Who Close'],'Close time':h['Time Close']}))info.append(el('p',label+': '+(value??'Not supplied')));receiptBody.append(info);
 const lines=el('div');table(lines,copy.lines.map(line=>({Item:line.Product||line['Discount/Coupon']||line['Line Description']||line.ProdTypeName||'Line',Qty:line['POSDetail QUAN'],'Unit value':line['Cost Each'],Value:line.Value})));if(!copy.lines.length)lines.replaceChildren(el('p','Item lines were not supplied for this transaction. Header totals are shown below.','muted'));receiptBody.append(lines);
 const totals=el('div','','receipt-totals');totals.append(el('p','Net total: '+money(h['Net Total'])+' '+r.currency));
 for(let i=1;i<=5;i++)if(Number(h['Tax'+i]))totals.append(el('p','Tax'+i+': '+money(h['Tax'+i])+' '+r.currency));totals.append(el('strong','TOTAL: '+money(h['Final Total'])+' '+r.currency));
 receiptBody.append(totals);
 const snapshot=visibleSnapshots.find(s=>s.restaurant_id===row['Branch ID']&&s.day===row.Day);
 const payments=(snapshot?.reports.payment||[]).filter(p=>String(p['Transaction #'])===String(h['Transaction #']));
 if(payments.length){const section=el('div','','receipt-payments');section.append(el('h3','Payment details'));for(const payment of payments)section.append(el('p',payment['Payment Type']+': '+money(payment.Amount)+' '+r.currency));receiptBody.append(section);}
 receiptBody.append(el('p',p.footer,'receipt-footer'),el('p','Developed by: Ebosoft.solutions','developer-credit'),el('p',payments.length?'Applied discount details are not provided by the summary query.':'Payment and applied discount details are not supplied by the current summary query.','muted'));decorateSaudiReceipt(row,p,h);isolateSaudiValues(row,p,h);receiptDialog.showModal();
}

let customerState=null;
const saveCustomer=el('button','Save customer details','secondary');
saveCustomer.onclick=()=>saveCustomerDetails();
receiptToolbar.insertBefore(saveCustomer,closeReceipt);
function saveCustomerDetails(){
 if(!customerState)return false;
 if(mode==='api'&&currentAccount?.role==='viewer')return false;
 const {key,name,vat,status}=customerState;
 try{localStorage.setItem(key,JSON.stringify({name:name.value.trim(),vat:vat.value.trim()}));status.textContent='Customer details saved on this browser for this transaction.';return true;}
 catch{status.textContent='Could not save: browser storage is unavailable. You can still print the entered details.';return false;}
}
function customerEditor(row,header){
 const key=customerStorageKey(mode,row['Branch ID'],row.Day,row['Transaction #']);let stored={};
 try{stored=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
 const panel=el('section','','customer-panel'),heading=el('h3','Customer details'),form=el('div','','customer-fields'),print=el('div','','customer-print'),name=document.createElement('input'),vat=document.createElement('input'),status=el('p','Edits apply to this reporting copy only; the original POS record is unchanged. Saved locally in this browser.','muted customer-help');
 name.readOnly=vat.readOnly=mode==='api'&&currentAccount?.role==='viewer';
 name.id='customerName';name.maxLength=160;name.autocomplete='organization';name.value=stored.name??header['Customer Name']??'';
 vat.id='customerVat';vat.maxLength=80;vat.autocomplete='off';vat.value=stored.vat??header['Customer VAT']??'';
 const nameLabel=el('label','Customer name'),vatLabel=el('label','Customer VAT number');nameLabel.append(name);vatLabel.append(vat);form.append(nameLabel,vatLabel);
 const sync=()=>{print.replaceChildren(el('p','Customer: '+(name.value.trim()||'Not provided')),el('p','Customer VAT number: '+(vat.value.trim()||'Not provided')));};
 name.oninput=sync;vat.oninput=sync;sync();panel.append(heading,form,print,status);customerState={key,name,vat,status};return panel;
}

const printReport=el('button','Print report / Save PDF','secondary');printReport.type='button';printReport.onclick=()=>window.print();$('csv').parentElement.append(printReport);

refresh();


window.addEventListener('beforeprint',()=>{if(!receiptDialog.open&&active!=='overview'&&result){table($('reportTable'),rows);}});
window.addEventListener('afterprint',()=>{if(active!=='overview')renderReport();});



function enhanceWidgets(){
 if(!result)return;
 const currency=$('currency').value;
 const daily=result.reports.daily.rows;
 const payments=paymentSummary(visibleSnapshots);
 bars('payments',payments.available?payments.rows.map(r=>[r.Name,r.Amount]):[]);
 if(!payments.available)$('payments').replaceChildren(el('p','Payment source is not connected. Requires tender allocations, including split payments.','empty'));
 else {const total=el('div',money(payments.total)+' '+currency,'payment-total'),note=el('p','Payment allocations; split tenders are counted separately.','muted');$('payments').prepend(total,note);}
 const ns='http://www.w3.org/2000/svg';
 document.querySelectorAll('#cards .card').forEach((card,i)=>{
 const svg=document.createElementNS(ns,'svg');svg.classList.add('sparkline');svg.setAttribute('viewBox','0 0 90 32');svg.setAttribute('aria-label','Selected-period trend');
 const key=['Net','Gross','Checks','Average'][i],values=daily.slice(-7).map(r=>key==='Average'?(r.Checks?r.Net/r.Checks:0):r[key]);if(!values.length)return;
 const min=Math.min(...values),max=Math.max(...values),path=document.createElementNS(ns,'polyline');
 path.setAttribute('points',values.map((v,j)=>(3+j*84/Math.max(1,values.length-1))+','+(27-(v-min)/Math.max(.01,max-min)*22)).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke',['#8876de','#2aaa98','#e4a561','#79a7dc'][i]);path.setAttribute('stroke-width','2');svg.append(path);card.append(svg);
 });
 const trendSvg=$('trend').querySelector('svg'),line=trendSvg?.querySelector('polyline');
 if(line){const points=line.getAttribute('points').trim().split(' '),poly=document.createElementNS(ns,'polygon');poly.setAttribute('points',points[0].split(',')[0]+',190 '+points.join(' ')+' '+points.at(-1).split(',')[0]+',190');poly.setAttribute('fill','#8b77d9');poly.setAttribute('opacity','.08');trendSvg.insertBefore(poly,line);line.setAttribute('stroke','#8b77d9');}
 const products=result.reports.product.rows;
 $('products').querySelectorAll('.bar').forEach((bar,i)=>{bar.dataset.rank=String(i+1).padStart(2,'0');bar.tabIndex=0;bar.setAttribute('role','button');bar.setAttribute('aria-label','View '+products[i].Name+' product report');const open=()=>{show('product');$('search').value=products[i].Name;renderReport();};bar.onclick=open;bar.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};});
 $('types').querySelectorAll('.fill').forEach((fill,i)=>{fill.style.background=['#8b78db','#35b4a3','#f0b466','#7cabe9'][i%4];});
 const typeRows=result.reports.type.rows,total=typeRows.reduce((a,r)=>a+r.Net,0);
 if(total>0&&typeRows.every(r=>r.Net>=0)){
 const wrap=el('div','','donut-wrap'),svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 160 160');svg.setAttribute('role','img');svg.setAttribute('aria-label','Sales share by order type');
 let offset=0;const circumference=2*Math.PI*63;
 typeRows.forEach((r,i)=>{const c=document.createElementNS(ns,'circle');for(const [k,v]of Object.entries({cx:80,cy:80,r:63,fill:'none',stroke:['#8b78db','#35b4a3','#f0b466','#7cabe9'][i%4],'stroke-width':15,'stroke-dasharray':(r.Net/total*circumference)+' '+circumference,'stroke-dashoffset':-offset}))c.setAttribute(k,v);offset+=r.Net/total*circumference;const title=document.createElementNS(ns,'title');title.textContent=r.Name+' '+(r.Net/total*100).toFixed(1)+'%';c.append(title);svg.append(c);});
 const caption=el('div','','donut-caption');caption.append(el('span','NET SALES'),el('strong',money(total)),el('span',currency));wrap.append(svg,caption);$('types').prepend(wrap);
 }
 const compareArticle=$('compare').parentElement;compareArticle.querySelectorAll('.widget-total,.widget-caption').forEach(n=>n.remove());
 const comparisonValues=[...$('compare').querySelectorAll('.bar-label b')];if(comparisonValues.length===2){const value=el('div',comparisonValues[1].textContent+' '+currency,'widget-total'),caption=el('div','Today - provisional net sales','widget-caption');compareArticle.insertBefore(value,$('compare'));compareArticle.insertBefore(caption,$('compare'));}
 let insight=$('insight');if(!insight){insight=el('div','','');insight.id='insight';$('cards').parentElement.insertBefore(insight,document.querySelector('.charts'));}
 insight.replaceChildren();const icon=el('span','i','insight-icon'),message=el('span','');if(products.length){const name=products[0].Name.split(' | ').slice(1).join(' | ')||products[0].Name;message.append(el('b',name),document.createTextNode(' leads product value for the selected dates at '+money(products[0].Value)+' '+currency+'. Select a product in the widget to inspect its report.'));}else message.textContent='Select a restaurant and date range to explore performance.';insight.append(icon,message);
}

for(const [label,offset]of [['Today',0],['Yesterday',-1],['Last 30 days',-29]]){
 const button=el('button',label,'secondary');button.type='button';button.onclick=()=>{const selected=restaurants.find(r=>r.id===$('restaurant').value)||restaurants[0];const day=localDay(selected?.timezone||'Asia/Bahrain');$('from').value=shift(day,offset);$('to').value=offset===-1?shift(day,-1):day;refresh();};$('filters').append(button);
}


let saudiQrState=null;
function makeQrSvg(payload){
 const qr=qrcodegen.QrCode.encodeText(payload,qrcodegen.QrCode.Ecc.MEDIUM),ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.id='zatcaQr';svg.setAttribute('viewBox','0 0 '+(qr.size+8)+' '+(qr.size+8));svg.setAttribute('role','img');svg.setAttribute('aria-label','ZATCA Phase 1 QR code');svg.setAttribute('shape-rendering','crispEdges');svg.dataset.payload=payload;
 const bg=document.createElementNS(ns,'rect');bg.setAttribute('width','100%');bg.setAttribute('height','100%');bg.setAttribute('fill','white');svg.append(bg);
 let d='';for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.getModule(x,y))d+='M'+(x+4)+','+(y+4)+'h1v1h-1z';const path=document.createElementNS(ns,'path');path.setAttribute('d',d);path.setAttribute('fill','black');svg.append(path);return svg;
}
function decorateSaudiReceipt(row,p,h){
 saudiQrState=null;
 if(String(p.country).toUpperCase()!=='SA')return;
 receiptBody.classList.add('saudi-copy');
 const translation={'TRANSACTION COPY':'뫦� ������','Tax registration':'���� �����','Transaction number':'��� ������','Date':'�颟��','Branch':'����','Order type':'��� ����','Table number':'��� �����','Closed by':'����� ������','Close time':'�� �����','Net total':'�靤��� �� ���','TOTAL':'�靤��� ���� ���','Payment details':'�埭�� ����','Customer details':'��럢 ������','Customer name':'��� ������','Customer VAT number':'���� ����� ������','Customer':'������',Item:'����',Qty:'�����','Unit value':'��� ������',Value:'�����'};
 const walker=document.createTreeWalker(receiptBody,NodeFilter.SHOW_TEXT);const texts=[];while(walker.nextNode())texts.push(walker.currentNode);
 texts.forEach(node=>{let value=node.textContent;for(const [en,ar]of Object.entries(translation).sort((a,b)=>b[0].length-a[0].length)){if(value===en||value.startsWith(en+':')){node.textContent=value.replace(en,en+' / '+ar);break;}}if(/^Tax[1-5]:/.test(value))node.textContent=value.replace(':',' / � ����� ������:');});
 const arName=el('p',p.nameAr||'�韫� ��㩠� �� ���','arabic-copy');arName.lang='ar';arName.dir='rtl';receiptBody.querySelector('h2').after(arName);
 if(p.addressAr){const a=el('p',p.addressAr,'arabic-copy');a.lang='ar';a.dir='rtl';arName.after(a);}
 if(p.footerAr){const f=el('p',p.footerAr,'arabic-copy');f.lang='ar';f.dir='rtl';receiptBody.querySelector('.receipt-footer').after(f);}
 const arabicProducts={'Espresso':'������','Cappuccino':'蟠�����','Latte':'韢��','Iced Americano':'������ ��','Flat White':'�韢 ��','Club Sandwich':'���� ����','Chicken Wrap':'�埞� �駤��','Caesar Salad':'��� �睊','Croissant':'�ퟫ��','Chocolate Cake':'��� �����韢�','Fresh Orange':'�� ����� ៪�','Lemon Mint':'����� �������'};
 const copy=transactionCopy(visibleSnapshots,row['Branch ID'],row.Day,row['Transaction #']);
 receiptBody.querySelectorAll('tbody tr').forEach((tr,i)=>{const line=copy?.lines[i],ar=line?.['Product Arabic']||(mode==='demo'?arabicProducts[line?.Product]:'');if(ar){const label=el('small',ar,'arabic-item');label.dir='rtl';label.lang='ar';tr.cells[0].append(label);}else tr.cells[0].append(el('small','�颩�� ��㩠� �� ��婡','arabic-item'));});
 const wrap=el('section','','zatca-section'),timestamp=el('p','Invoice timestamp / �� ����� ��埢���: '+(h['Invoice Timestamp']||'Not supplied / �� ���')),display=el('div','','qr-display'),status=el('p','','muted');
 wrap.append(timestamp,display,status,el('p','Phase 1 reporting copy / 뫦� ��� ��� ��ꩥ� �����','muted'));receiptBody.append(wrap);
 saudiQrState={wrap,display,status,p,h};
 updateSaudiQr();
 if(customerState){const sync=()=>{receiptBody.querySelector('.customer-print').replaceChildren(el('p','Customer / ������: '+(customerState.name.value.trim()||'Not provided')),el('p','Customer VAT number / ���� ����� ������: '+(customerState.vat.value.trim()||'Not provided')));};customerState.name.oninput=sync;customerState.vat.oninput=sync;sync();}
}
function updateSaudiQr(){
 if(!saudiQrState)return true;
 const {p,h,display,status}=saudiQrState;display.replaceChildren();
 try{const tax=[1,2,3,4,5].reduce((a,i)=>a+Number(h['Tax'+i]||0),0),payload=phase1Payload({seller:p.nameAr||p.name,vat:p.taxNumber,timestamp:h['Invoice Timestamp'],total:h['Final Total'],tax});
 display.append(makeQrSvg(payload));status.textContent='Seller VAT and original invoice timestamp encoded. / �� ���� ��럢 �頟�� ��� ��埢���';printReceipt.disabled=false;return true;
 }catch(e){status.textContent='QR unavailable: '+e.message;printReceipt.disabled=true;return false;}
}
function moreWidgets(){
 if(!result)return;
 for(const [id,key,metric]of [['hourlyWidget','hourly','Net'],['employeeWidget','employee','Net']]){const report=result.reports[key];bars(id,report.available===false?[]:report.rows.slice().sort((a,b)=>key==='hourly'?a.Name.localeCompare(b.Name):b.Net-a.Net).slice(0,12).map(r=>[r.Name,r[metric]]));}
 const tile=$('controlsWidget');tile.replaceChildren();
 for(const [key,label,amount]of [['discount','Discounts / �馭�꟢','Discount amount'],['void','Voids / ���䟘��','Void amount']]){
 const report=result.reports[key],card=el('div','','control-tile');card.append(el('span',label),el('strong',report.available===false?'Source pending':money(report.rows.reduce((a,r)=>a+Number(r[amount]||0),0))),el('small',report.available===false?'Not connected':report.rows.length+' records'));tile.append(card);
 }
 const taxRows=result.reports.tax.rows;bars('taxWidget',[1,2,3,4,5].map(i=>['Tax'+i,taxRows.reduce((a,r)=>a+Number(r['Tax'+i]||0),0)]).filter(r=>r[1]!==0));
}


function isolateSaudiValues(row,p,h){
 if(String(p.country).toUpperCase()!=='SA')return;
 const pairs=[['Transaction number','��� ������',h['Transaction #']],['Date','�颟��',row.Day],['Branch','����',p.name],['Order type','��� ����',h['Sales Type']],['Table number','��� �����',h['Table #']],['Closed by','����� ������',h['Who Close']],['Close time','�� �����',h['Time Close']]];
 for(const paragraph of receiptBody.querySelectorAll(':scope>p'))if(paragraph.textContent.startsWith('Tax registration')){const vat=el('bdi',p.taxNumber);vat.dir='ltr';paragraph.replaceChildren(el('span','Tax registration / ���� �����: '),vat);}
 const info=receiptBody.querySelector('.receipt-info');info.replaceChildren();
 for(const [en,ar,value]of pairs){const line=el('p','','bilingual-field'),label=el('span',en+' / '+ar),bdi=el('bdi',value??'Not supplied / �� ���');bdi.dir='auto';line.append(label,bdi);info.append(line);}
 const total=receiptBody.querySelector('.receipt-totals');total.replaceChildren();
 const add=(label,value,strong=false)=>{const line=el(strong?'strong':'p','','bilingual-total'),amount=el('bdi',Number(value).toFixed(2)+' '+(rCurrency(row)||'SAR'));amount.dir='ltr';line.append(el('span',label),amount);total.append(line);};
 add('Net total / �靤��� �� ���',h['Net Total']);for(let i=1;i<=5;i++)if(Number(h['Tax'+i]))add('Tax'+i+' / � ����� ������',h['Tax'+i]);add('TOTAL / �靤��� ���� ���',h['Final Total'],true);
 const credit=receiptBody.querySelector('.developer-credit');if(credit)receiptBody.append(credit);
 const timestamp=receiptBody.querySelector('.zatca-section>p');if(timestamp){timestamp.replaceChildren(el('span','Invoice timestamp / �� ����� ��埢���: '));const bdi=el('bdi',h['Invoice Timestamp']||'Not supplied');bdi.dir='ltr';timestamp.append(bdi);}
}
function rCurrency(row){return restaurants.find(r=>r.id===row['Branch ID'])?.currency;}

$('currency').onchange=()=>refresh();

access=initAccess({
 signedIn:async user=>{currentAccount=user;restaurants=await api('/api/restaurants');source=[];mode='api';options();$('badge').textContent='SIGNED IN';$('notice').textContent='Brand '+user.tenant_id+' / '+user.role+' / server-enforced restaurant access.';await refresh();await updateLocalSync();},
 signedOut:()=>{currentAccount=null;$('localSyncBar').hidden=true;mode='demo';restaurants=sample.restaurants;source=sample.snapshots;options();$('badge').textContent='DEMO DATA';$('notice').textContent='Signed out. Only synthetic demo data is displayed.';refresh();}
});

$('country').onchange=()=>{$('restaurant').value='';options();refresh();};

async function updateLocalSync(){try{const status=await api('/api/sync-status');$('localSyncBar').hidden=false;$('refreshSource').hidden=currentAccount?.role==='viewer';$('refreshSource').disabled=status.state==='syncing';$('badge').textContent='LIVE LOCAL';$('notice').textContent='PixelPoint snapshot on this computer / LAB Naeem test / BHD. No cloud synchronization is configured.';$('syncHealth').textContent='Source: '+status.state+(status.lastSuccess?' / Last successful refresh: '+new Date(status.lastSuccess).toLocaleString():'');}catch{$('localSyncBar').hidden=true;}}
$('refreshSource').onclick=async()=>{try{$('refreshSource').disabled=true;await access.request('/api/local-refresh',{method:'POST',body:'{}'});await updateLocalSync();let checks=0;const timer=setInterval(async()=>{checks++;await updateLocalSync();if(!$('refreshSource').disabled||checks>=45){clearInterval(timer);await refresh();}},2000);}catch(e){$('syncHealth').textContent=e.message;$('refreshSource').disabled=false;}};
setInterval(()=>{if(mode==='api'&&currentAccount&&document.visibilityState==='visible'){refresh();updateLocalSync();}},30000);
