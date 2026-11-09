import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';import {join,resolve,sep} from 'node:path';import {randomBytes} from 'node:crypto';import {spawn} from 'node:child_process';import assert from 'node:assert/strict';
const base=resolve('local-live'),dir=mkdtempSync(join(base,'service-qa-')),key=randomBytes(32).toString('hex'),password='QA-only-'+randomBytes(12).toString('hex'),email='qa-service@example.test';
const cloud=join(dir,'cloud.json'),connector=join(dir,'connector.json'),status=join(dir,'sync-status.json'),urlFile=join(dir,'last-url.txt');let service;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function statusReady(previous=null){for(let i=0;i<120;i++){await wait(250);if(existsSync(status)){let s;try{s=JSON.parse(readFileSync(status,'utf8'));}catch{continue;}if(s.state==='sync error')throw Error('Source connector reported an error.');if(s.state==='connected'&&s.lastSuccess&&(!previous||s.lastSuccess!==previous))return s;}}throw Error('Local source refresh timed out.');}
try{
 writeFileSync(cloud,JSON.stringify({viewers:[],restaurants:[{id:'local-pixelpoint',tenant_id:'qa-service',name:'LAB Naeem test',country:'BH',currency:'BHD',timezone:'Asia/Bahrain',key}]}));
 writeFileSync(connector,JSON.stringify({restaurant_id:'local-pixelpoint',api_url:'http://127.0.0.1:1',allow_http_local:true,key_env:'PIXELPOINT_API_KEY',timezone:'Asia/Bahrain',mode:'interval',interval_seconds:300,lookback_days:2,outbox:join(dir,'outbox'),source_owner:'DBA',powershell_path:'C:\\Windows\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe'}));
 const env={...process.env,DEMO:'true',DEMO_DB:join(dir,'live.db'),CLOUD_CONFIG:cloud,LOCAL_STATE_DIR:dir,ADMIN_EMAIL:email,ADMIN_PASSWORD:password,BOOTSTRAP_TENANT_ID:'qa-service',PIXELPOINT_API_KEY:key,OPEN_BROWSER:'false'};
 service=spawn(process.execPath,['scripts/local-dashboard.mjs'],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});
 let stderr='';service.stderr.on('data',b=>stderr+=b.toString());service.stdout.on('data',()=>{});
 const first=await statusReady();assert.ok(existsSync(urlFile));const baseUrl=readFileSync(urlFile,'utf8');
 let response=await fetch(baseUrl+'/api/report?from=2026-10-26&to=2026-10-27');assert.equal(response.status,401);
 response=await fetch(baseUrl+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(response.status,200);const data=await response.json(),cookie=response.headers.get('set-cookie').split(';')[0];
 response=await fetch(baseUrl+'/api/local-refresh',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);
 response=await fetch(baseUrl+'/api/local-refresh',{method:'POST',headers:{cookie,'Content-Type':'application/json','X-CSRF-Token':data.csrf},body:'{}'});assert.equal(response.status,202);const second=await statusReady(first.lastSuccess);
 response=await fetch(baseUrl+'/api/report?from=2026-10-26&to=2026-10-27',{headers:{cookie}});const report=await response.json();const day=report.snapshots.find(s=>s.day==='2026-10-26');assert.ok(day.reports.transaction_summary.length>0);assert.ok(day.reports.transaction_detail.length>0);
 const {chromium}=await import('file:///C:/Users/DELL/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(baseUrl);await page.waitForSelector('#loginDialog[open]');await page.locator('#loginDialog').getByLabel('Email',{exact:true}).fill(email);await page.locator('#loginDialog').getByLabel('Password',{exact:true}).fill(password);await page.locator('#loginDialog').getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#badge').textContent==='LIVE LOCAL');
 await page.getByRole('button',{name:'Refresh from PixelPoint',exact:true}).click();await statusReady(second.lastSuccess);await page.getByRole('button',{name:'Transaction register',exact:true}).click();await page.waitForSelector('#reportTable .transaction-link');await page.locator('#reportTable .transaction-link').first().click();assert.ok(await page.locator('#receiptDialog').isVisible());assert.deepEqual(errors,[]);
 }finally{await browser.close();}
 console.log('LIVE SERVICE QA PASSED: real PixelPoint snapshot, local authentication, protected manual refresh, real dashboard and transaction copy. No sales data sent to cloud.');
}finally{
 if(service&&service.exitCode===null){service.kill();await new Promise(r=>service.once('exit',r));}
 const safe=resolve(dir);if(!safe.startsWith(base+sep)||!safe.split(sep).at(-1).startsWith('service-qa-'))throw Error('Unsafe QA cleanup target');rmSync(safe,{recursive:true,force:true});
}

