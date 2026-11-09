import http from 'node:http';import {readFileSync,existsSync} from 'node:fs';import {randomBytes,randomUUID} from 'node:crypto';
import {hash,equal,validate,summarize} from './core.mjs';import {openStore} from './store.mjs';import {createAuth,scopeUser} from './auth.mjs';
import {monitorRows} from './monitor.mjs';
import {defaultSync,validateSync} from '../connector/sync-plan.mjs';
import {reconcile} from './reconcile.mjs';
import {planDays} from '../connector/sync-plan.mjs';
export async function start(port=Number(process.env.PORT||8080),options={}){
 const configPath=process.env.CLOUD_CONFIG||'config/cloud.json';
 const imported=existsSync(configPath)?JSON.parse(readFileSync(configPath,'utf8').replace(/^\uFEFF/,'')):{restaurants:[]};
 const store=await openStore();await store.administration.initialize(imported);const initial=await store.administration.load();
 const auth=await createAuth(store.auth,initial.config);
 const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'");
 const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 const body=async(limit=65536)=>{let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>limit)throw Object.assign(Error('Request is too large'),{status:413});}try{return JSON.parse(text);}catch{throw Object.assign(Error('Invalid JSON'),{status:400});}};
 try{
 let {config,version}=await store.administration.load();const saveConfig=async()=>{const event={id:Date.now().toString().padStart(16,'0')+'-'+randomUUID(),tenant_id:state.user.tenant_id,actor:state.user.id,action:'configuration_updated',target:path,at:new Date().toISOString()};version=await store.administration.save(config,version,event);};
 const url=new URL(req.url,'http://localhost'),path=url.pathname,token=(req.headers.authorization||'').replace(/^Bearer /,'');
 if(path==='/health')return send(200,{status:'ok'});
 if(path==='/ready')return send(200,{status:'ready',storage:process.env.DATABASE_URL?'postgresql':'sqlite'});
 const assets={'/':'index.html','/app.js':'app.js','/reports.mjs':'reports.mjs','/zatca.mjs':'zatca.mjs','/qrcodegen.js':'qrcodegen.js','/auth-ui.js':'auth-ui.js','/reconciliation-ui.js':'reconciliation-ui.js','/style.css':'style.css'};
 if(req.method==='GET'&&assets[path]){const file=assets[path];res.writeHead(200,{'Content-Type':file.endsWith('html')?'text/html':file.endsWith('js')?'text/javascript':'text/css'});return res.end(readFileSync(new URL('../dashboard/'+file,import.meta.url)));}
 const restaurants=(await store.restaurants()).filter(r=>config.restaurants.some(c=>c.id===r.id));
 if(req.method==='GET'&&path==='/api/connector-state'){
 const r=config.restaurants.find(r=>r.id===req.headers['x-restaurant-id']&&r.active!==false&&equal(r.key_hash,hash(token)));if(!r)return send(401,{error:'Unauthorized'});
 const rows=await store.connectorStates([r.id]);return send(200,{restaurant_id:r.id,sequence:Number(rows[0]?.sequence||0)});
 }
 if(req.method==='POST'&&path==='/api/ingest'){
 const r=config.restaurants.find(r=>r.id===req.headers['x-restaurant-id']&&r.active!==false&&equal(r.key_hash,hash(token)));if(!r)return send(401,{error:'Unauthorized'});
 const payload=await body(25*1024*1024);try{validate(payload);}catch(e){return send(400,{error:e.message});}
 return send(200,{accepted:true,changed:await store.put(r.id,payload)});}
 if(req.method==='POST'&&path==='/auth/login'){
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(415,{error:'Use application/json'});
 return send(200,await auth.login(req,await body(),res));}
 const state=await auth.session(req);
 if(req.method==='POST'&&path==='/auth/logout')return send(200,await auth.logout(req,state,res));
 if(req.method==='GET'&&path==='/auth/me'){if(!state)return send(401,{error:'Sign in required'});return send(200,{user:auth.publicUser(state.user),csrf:state.session.csrf});}
 if(req.method==='POST'&&path==='/auth/password'){if(!state)return send(401,{error:'Sign in required'});return send(200,await auth.changePassword(req,state,await body(),res));}
 if(state?.user.must_change)return send(403,{error:'Change your temporary password before accessing reports.',must_change:true});
 if(path==='/api/backoffice' || path==='/api/backoffice/brand' || path==='/api/backoffice/stores' || path.startsWith('/api/backoffice/stores/')){
 if(!state)return send(401,{error:'Sign in required'});if(state.user.role!=='admin')return send(403,{error:'Back-office administrator access required'});
 const tenant=state.user.tenant_id;
 const connectorMatch=path.match(/^\/api\/backoffice\/stores\/([^/]+)\/(connector|rotate-key|activation|schedule)$/);
 if(connectorMatch){
 const r=config.restaurants.find(r=>r.id===connectorMatch[1]&&r.tenant_id===tenant);if(!r)return send(404,{error:'Store not found'});
 if(connectorMatch[2]==='schedule'){
 if(req.method==='GET')return send(200,{restaurant_id:r.id,schedule:r.sync||defaultSync,timezone:r.timezone});
 if(req.method==='POST'){auth.csrf(req,state);const input=await body();let schedule;try{schedule=validateSync(input);}catch(e){return send(400,{error:e.message});}const old=r.sync;r.sync=schedule;try{await saveConfig();}catch(e){r.sync=old;throw e;}return send(200,{restaurant_id:r.id,schedule,timezone:r.timezone,message:'Saved. Apply these settings to the store connector configuration and restart it.'});}
 return send(405,{error:'Method not allowed'});
 }
 if(req.method==='GET'&&connectorMatch[2]==='connector')return send(200,{restaurant_id:r.id,name:r.name,active:r.active!==false,config:{restaurant_id:r.id,api_url:'https://YOUR-REPORTING-DOMAIN',key_env:'PIXELPOINT_API_KEY',timezone:r.timezone,mode:'interval',interval_seconds:300,daily_at:'02:00',lookback_days:8,...(r.sync||defaultSync),outbox:'connector/outbox',source_owner:'DBA'},instructions:'Set your real HTTPS API URL, matching ODBC driver/PowerShell path and environment secrets. Rotate the key to issue a new connector credential. Stop this store connector before rotating.'});
 if(req.method==='POST'&&connectorMatch[2]==='rotate-key'){
 auth.csrf(req,state);const input=await body();if(input.confirm!==r.id)return send(400,{error:'Confirm the store ID to rotate its key.'});
 const old=r.key_hash;const newKey=randomBytes(32).toString('hex');r.key_hash=hash(newKey);r.needs_key_rotation=false;try{await saveConfig();}catch(e){r.key_hash=old;throw e;}return send(200,{restaurant_id:r.id,key:newKey,message:'Save this key securely now. The previous key is revoked. Update the connector environment before restarting.'});
 }
 if(req.method==='POST'&&connectorMatch[2]==='activation'){
 auth.csrf(req,state);const input=await body();if(typeof input.active!=='boolean')return send(400,{error:'active must be true or false'});const old=r.active;r.active=input.active;try{await saveConfig();}catch(e){r.active=old;throw e;}return send(200,{restaurant_id:r.id,active:r.active});
 }
 return send(405,{error:'Method not allowed'});
 }
 if(path==='/api/backoffice'&&req.method==='GET')return send(200,{brand:{id:tenant,name:config.brands?.[tenant]?.name||tenant},stores:config.restaurants.filter(r=>r.tenant_id===tenant).map(({key_hash,...r})=>r)});
 if(path==='/api/backoffice/brand'&&req.method==='PATCH'){auth.csrf(req,state);const input=await body();const name=String(input.name||'').trim();if(!name||name.length>120)return send(400,{error:'Enter a brand name of up to 120 characters.'});config.brands||={};config.brands[tenant]={name};await saveConfig();return send(200,{id:tenant,name});}
 if(path==='/api/backoffice/stores'&&req.method==='POST'){
 auth.csrf(req,state);const input=await body();const name=String(input.name||'').trim();const choices={BH:['BHD','Asia/Bahrain'],SA:['SAR','Asia/Riyadh'],AE:['AED','Asia/Dubai'],PK:['PKR','Asia/Karachi'],KW:['KWD','Asia/Kuwait']};const setting=choices[input.country];
 if(!name||name.length>120||!setting)return send(400,{error:'Enter a store name and a supported country.'});
 const r={id:'store-'+randomUUID(),tenant_id:tenant,name,country:input.country,currency:setting[0],timezone:setting[1],key_hash:hash(randomBytes(32).toString('hex'))};config.restaurants.push(r);try{await saveConfig();}catch(e){config.restaurants.pop();throw e;}const {key_hash,...safe}=r;return send(201,safe);
 }
 const match=path.match(/^\/api\/backoffice\/stores\/([^/]+)$/);if(match&&req.method==='PATCH'){auth.csrf(req,state);const r=config.restaurants.find(r=>r.id===match[1]&&r.tenant_id===tenant);if(!r)return send(404,{error:'Store not found'});const input=await body(),name=String(input.name||'').trim();if(!name||name.length>120)return send(400,{error:'Enter a store name.'});r.name=name;await saveConfig();const {key_hash,...safe}=r;return send(200,safe);}
 return send(404,{error:'Not found'});
 }
 if(path==='/api/users'||path.startsWith('/api/users/')||path==='/api/audit'){
 if(!state)return send(401,{error:'Sign in required'});if(state.user.role!=='admin')return send(403,{error:'Brand administrator access required'});
 if(path==='/api/audit'&&req.method==='GET')return send(200,await auth.audits(state));
 if(path==='/api/users'&&req.method==='GET')return send(200,await auth.users(state));
 if(path==='/api/users'&&req.method==='POST')return send(201,await auth.addUser(req,state,await body(),restaurants));
 const match=path.match(/^\/api\/users\/([^/]+)(\/reset-password)?$/);
 if(match&&req.method==='POST'&&match[2])return send(200,await auth.resetPassword(req,state,match[1],await body()));
 if(match&&req.method==='PATCH'&&!match[2])return send(200,await auth.updateUser(req,state,match[1],await body(),restaurants));
 return send(404,{error:'Not found'});}
 const legacy=process.env.ALLOW_LEGACY_TOKENS==='true'?(config.viewers||[]).find(v=>equal(v.token,token)):null;
 if(!state&&!legacy)return send(401,{error:'Sign in required'});
 const user=state?.user||{...legacy,role:'viewer'},allowed=scopeUser(user,restaurants);
 if(req.method==='POST'&&path==='/api/reconcile'){
 if(!state)return send(401,{error:'Sign in required'});auth.csrf(req,state);const input=await body();const r=allowed.find(r=>r.id===input?.restaurant_id);if(!r)return send(403,{error:'Restaurant access denied'});
 try{reconcile([],input);}catch(e){return send(400,{error:e.message});}const snapshots=await store.get([r.id],input.from,input.to);let comparison;try{comparison=reconcile(snapshots,input);}catch(e){return send(422,{error:e.message});}
 return send(200,{...comparison,restaurant_id:r.id,currency:r.currency});
 }
 if(req.method==='GET'&&path==='/api/connectors')return send(200,{connectors:monitorRows(allowed.map(r=>({...r,active:config.restaurants.find(c=>c.id===r.id)?.active})),await store.connectorStates(allowed.map(r=>r.id))),stale_after_seconds:900});
 if(req.method==='POST'&&path==='/api/local-refresh'){
 if(!state)return send(401,{error:'Sign in required'});
 if(state.user.role==='viewer')return send(403,{error:'Manager or administrator access required'});
 auth.csrf(req,state);
 if(!options.localRefresh||!allowed.some(r=>r.id===process.env.LOCAL_SYNC_RESTAURANT_ID))return send(404,{error:'Not available'});
 return options.localRefresh()?send(202,{ok:true}):send(409,{error:'A refresh is already running.'});
 }
 if(req.method==='GET'&&path==='/api/sync-status'){
 if(!process.env.LOCAL_SYNC_STATUS||!allowed.some(r=>r.id===process.env.LOCAL_SYNC_RESTAURANT_ID))return send(404,{error:'Not available'});
 try{const status=JSON.parse(readFileSync(process.env.LOCAL_SYNC_STATUS,'utf8'));return send(200,{state:status.state,lastSuccess:status.lastSuccess||null});}
 catch{return send(200,{state:'starting',lastSuccess:null});}
 }
 if(req.method==='GET'&&path==='/api/restaurants')return send(200,allowed.map(({key_hash,...r})=>({...r,country:config.restaurants.find(c=>c.id===r.id)?.country||'BH',receipt:config.restaurants.find(c=>c.id===r.id)?.receipt||{}})));
 if(req.method==='GET'&&path==='/api/report'){
 const id=url.searchParams.get('restaurant'),country=url.searchParams.get('country');if(id&&!allowed.some(r=>r.id===id))return send(403,{error:'Restaurant access denied'});if(country&&!allowed.some(r=>(config.restaurants.find(c=>c.id===r.id)?.country||'BH')===country))return send(403,{error:'Country access denied'});const selected=allowed.filter(r=>(!id||id===r.id)&&(!country||(config.restaurants.find(c=>c.id===r.id)?.country||'BH')===country));
 const from=url.searchParams.get('from'),to=url.searchParams.get('to');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)return send(400,{error:'Invalid date range'});
 try{planDays(to,1,{from,to});}catch{return send(400,{error:'Use a valid date range of at most 366 days.'});}
 const snapshots=await store.get(selected.map(r=>r.id),from,to),currencies=[...new Set(selected.map(r=>r.currency))],groups={};
 for(const currency of currencies){const ids=new Set(selected.filter(r=>r.currency===currency).map(r=>r.id));groups[currency]=summarize(snapshots.filter(s=>ids.has(s.restaurant_id)));}
 return send(200,{...(currencies.length===1?groups[currencies[0]]:{totals:null}),currency:currencies.length===1?currencies[0]:null,groups,snapshots});}
 send(404,{error:'Not found'});
 }catch(e){if(e.status)return send(e.status,{error:e.message});console.error('Request failed:',e.message);send(500,{error:'Server error'});}
 });
 await new Promise(resolve=>server.listen(port,process.env.HOST||'127.0.0.1',resolve));console.log('Reporting API listening on',server.address().port);
 return {server,store,close:async()=>{await new Promise(r=>server.close(r));await store.close();}};
}
if(process.argv[1]?.endsWith('server.mjs'))start().catch(e=>{console.error(e.message);process.exit(1);});








