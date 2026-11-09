import {initializeConfig} from './init-config.mjs';
import {readFileSync,existsSync} from 'node:fs';import {spawn} from 'node:child_process';
process.env.DEMO='true';process.env.DEMO_DB=process.env.DEMO_DB||'login-demo.db';process.env.ALLOW_LEGACY_TOKENS='false';
if(!existsSync(process.env.CLOUD_CONFIG||'config/cloud.json'))initializeConfig();
const {start}=await import('../cloud/server.mjs');const {demo}=await import('../dashboard/reports.mjs');
const app=await start(Number(process.env.PORT||8080)),config=JSON.parse(readFileSync(process.env.CLOUD_CONFIG||'config/cloud.json','utf8').replace(/^\uFEFF/,''));
for(const snapshot of demo().snapshots)if(config.restaurants.some(r=>r.id===snapshot.restaurant_id))await app.store.put(snapshot.restaurant_id,{day:snapshot.day,sequence:Date.now(),reports:snapshot.reports});
const url='http://127.0.0.1:'+app.server.address().port;
console.log('Login dashboard ready:',url);console.log('Use your administrator email and password. Keep this window open. Ctrl+C stops the server.');
if(process.env.OPEN_BROWSER==='true'&&process.platform==='win32'){const browser=spawn('powershell.exe',['-NoProfile','-Command',"Start-Process '"+url+"'"],{stdio:'ignore',windowsHide:true});browser.unref();}
process.on('SIGINT',async()=>{await app.close();process.exit(0);});


