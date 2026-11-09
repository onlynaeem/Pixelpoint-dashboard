import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';import {join,resolve,sep} from 'node:path';import {randomBytes} from 'node:crypto';import {spawn} from 'node:child_process';import assert from 'node:assert/strict';
const base=resolve('local-live'),dir=mkdtempSync(join(base,'qa-')),key=randomBytes(32).toString('hex'),password='QA-only-'+randomBytes(12).toString('hex');
const cloud=join(dir,'cloud.json'),connector=join(dir,'connector.json'),status=join(dir,'status.json');let app;
try{
 const cfg={viewers:[],restaurants:[{id:'local-pixelpoint',tenant_id:'qa-only',name:'LAB Naeem test',country:'BH',currency:'BHD',timezone:'Asia/Bahrain',key}]};writeFileSync(cloud,JSON.stringify(cfg));writeFileSync(status,JSON.stringify({state:'connected',lastSuccess:new Date().toISOString()}));
 process.env.DEMO='true';process.env.SESSION_SECURE='false';process.env.ALLOW_LEGACY_TOKENS='false';process.env.DEMO_DB=join(dir,'test.db');process.env.CLOUD_CONFIG=cloud;process.env.ADMIN_EMAIL='qa@example.test';process.env.ADMIN_PASSWORD=password;process.env.BOOTSTRAP_TENANT_ID='qa-only';process.env.LOCAL_SYNC_STATUS=status;process.env.LOCAL_SYNC_RESTAURANT_ID='local-pixelpoint';
 const {start}=await import('../cloud/server.mjs');app=await start(0);const port=app.server.address().port,baseUrl='http://127.0.0.1:'+port;
 writeFileSync(connector,JSON.stringify({restaurant_id:'local-pixelpoint',api_url:baseUrl,allow_http_local:true,key_env:'PIXELPOINT_API_KEY',timezone:'Asia/Bahrain',mode:'interval',interval_seconds:300,lookback_days:2,outbox:join(dir,'outbox'),source_owner:'DBA',powershell_path:'C:\\Windows\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe'}));
 const child=spawn(process.execPath,['connector/agent.mjs','--from','2026-10-26','--to','2026-10-26','--once'],{env:{...process.env,CONNECTOR_CONFIG:connector,PIXELPOINT_API_KEY:key},stdio:['ignore','ignore','pipe'],windowsHide:true});
 let childError='';child.stderr.on('data',b=>childError+=b.toString());const code=await new Promise((resolveExit,reject)=>{const timer=setTimeout(()=>{child.kill();reject(Error('Connector QA timed out'));},90000);child.on('error',reject);child.on('exit',n=>{clearTimeout(timer);resolveExit(n);});});
 if(code!==0)throw Error('Connector exited with code '+code+'; source error was suppressed to protect sensitive data.');
 let response=await fetch(baseUrl+'/api/report?from=2026-10-26&to=2026-10-27');assert.equal(response.status,401);
 response=await fetch(baseUrl+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'qa@example.test',password})});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0];
 response=await fetch(baseUrl+'/api/report?from=2026-10-26&to=2026-10-27',{headers:{cookie}});assert.equal(response.status,200);const report=await response.json(),day=report.snapshots.find(s=>s.day==='2026-10-26');assert.ok(day);assert.ok(day.reports.transaction_summary.length>0);assert.ok(day.reports.transaction_detail.length>0);
 response=await fetch(baseUrl+'/api/sync-status',{headers:{cookie}});assert.equal((await response.json()).state,'connected');
 const {chromium}=await import('file:///C:/Users/DELL/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
 try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(baseUrl);await page.waitForSelector('#loginDialog[open]');await page.locator('#loginDialog').getByLabel('Email',{exact:true}).fill('qa@example.test');await page.locator('#loginDialog').getByLabel('Password',{exact:true}).fill(password);await page.locator('#loginDialog').getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#badge').textContent==='LIVE LOCAL');await page.locator('#from').fill('2026-10-26');await page.locator('#to').fill('2026-10-26');await page.getByRole('button',{name:'Apply filters',exact:true}).click();await page.getByRole('button',{name:'Transaction register',exact:true}).click();await page.waitForSelector('#reportTable .transaction-link');await page.locator('#reportTable .transaction-link').first().click();assert.ok(await page.locator('#receiptDialog').isVisible());assert.deepEqual(errors,[]);}finally{await browser.close();}
 console.log('LIVE LOCAL QA PASSED: source connector, local authenticated API, dashboard login and transaction copy. Source rows remained local.');
}finally{
 if(app)await app.close();const safe=resolve(dir);if(!safe.startsWith(base+sep)||!safe.split(sep).at(-1).startsWith('qa-'))throw Error('Unsafe QA cleanup target');rmSync(safe,{recursive:true,force:true});
}



