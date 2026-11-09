import {openSync,closeSync,readFileSync,writeFileSync,unlinkSync,existsSync,mkdirSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';import {spawn} from 'node:child_process';import {start} from '../cloud/server.mjs';
import {createSchedule} from './sync-schedule.mjs';
const state=resolve(process.env.LOCAL_STATE_DIR||'local-live'),lock=join(state,'service.lock'),agentPidFile=join(state,'agent.pid'),statusFile=join(state,'sync-status.json'),connectorFile=join(state,'connector.json');
mkdirSync(state,{recursive:true});
function running(pid){try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}}
function stale(file){if(!existsSync(file))return;const pid=Number(readFileSync(file,'utf8'));if(Number.isInteger(pid)&&pid>0&&running(pid))throw Error('Another local dashboard process is running.');unlinkSync(file);}
stale(lock);const fd=openSync(lock,'wx');writeFileSync(fd,String(process.pid));closeSync(fd);
let app,agent,schedule,timer,agentEnv=null,lastSuccess=null,closing=false;
try{lastSuccess=JSON.parse(readFileSync(statusFile,'utf8')).lastSuccess||null;}catch{}
function status(name){try{writeFileSync(statusFile,JSON.stringify({state:name,lastSuccess}));}catch{}}
function clearOwnLock(){try{if(readFileSync(lock,'utf8')===String(process.pid))unlinkSync(lock);}catch{}}
function launchAgent(){
 if(!agentEnv||closing||(agent&&agent.exitCode===null))return false;
 schedule?.attempted(Date.now());status('syncing');agent=spawn(process.execPath,['connector/agent.mjs','--once'],{cwd:process.cwd(),env:agentEnv,windowsHide:true,stdio:['ignore','pipe','pipe']});
 if(agent.pid)writeFileSync(agentPidFile,String(agent.pid));let buffer='',succeeded=false;
 agent.stdout.on('data',chunk=>{buffer=(buffer+chunk.toString()).slice(-1000);if(buffer.includes('Sync completed')){lastSuccess=new Date().toISOString();succeeded=true;buffer='';}});
 agent.stderr.on('data',()=>{status('sync error');console.error('PixelPoint synchronization reported an error.');});
 agent.on('exit',code=>{if(!closing){status(code===0&&succeeded?'connected':'sync error');if(code===0&&succeeded){schedule?.succeeded(Date.now());console.log('PixelPoint local snapshot refreshed.');}}try{if(Number(readFileSync(agentPidFile,'utf8'))===agent.pid)unlinkSync(agentPidFile);}catch{}});
 agent.on('error',()=>{status('sync error');});return true;
}
async function close(){if(closing)return;closing=true;clearInterval(timer);status('stopped');if(agent&&agent.exitCode===null)agent.kill();if(app)await app.close();agentEnv=null;clearOwnLock();}
try{
 if(existsSync(agentPidFile)){const old=Number(readFileSync(agentPidFile,'utf8'));if(Number.isInteger(old)&&old>0&&running(old))throw Error('A previous reporting connector is still running. Stop it before restarting.');unlinkSync(agentPidFile);}
 const outbox=resolve(state,'outbox');if(!outbox.startsWith(state+sep))throw Error('Invalid outbox path.');mkdirSync(outbox,{recursive:true});
 const staleAgentLock=join(outbox,'agent.lock');if(existsSync(staleAgentLock))unlinkSync(staleAgentLock);
 status('starting');
 process.env.HOST='127.0.0.1';process.env.DEMO='true';process.env.SESSION_SECURE='false';process.env.ALLOW_LEGACY_TOKENS='false';
 process.env.LOCAL_SYNC_STATUS=statusFile;process.env.LOCAL_SYNC_RESTAURANT_ID='local-pixelpoint';
 app=await start(0,{localRefresh:launchAgent});const port=app.server.address().port;
 const cfg=JSON.parse(readFileSync(connectorFile,'utf8').replace(/^\uFEFF/,''));cfg.api_url='http://127.0.0.1:'+port;cfg.outbox=outbox;writeFileSync(connectorFile,JSON.stringify(cfg,null,2));
 schedule=createSchedule(cfg);
 agentEnv={...process.env,CONNECTOR_CONFIG:connectorFile};delete agentEnv.ADMIN_PASSWORD;delete agentEnv.ADMIN_EMAIL;
 delete process.env.PIXELPOINT_ODBC;delete process.env.PIXELPOINT_API_KEY;
 launchAgent();
 timer=setInterval(()=>{if(schedule.due(Date.now()))launchAgent();},1000);
 const url='http://127.0.0.1:'+port;writeFileSync(join(state,'last-url.txt'),url);
 console.log('Local dashboard:',url);console.log('LAB Naeem test / BHD. Automatic synchronization is enabled using the connector schedule. Keep this window open; Ctrl+C stops it.');
 if(process.env.OPEN_BROWSER==='true'&&process.platform==='win32'){const opener=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{stdio:'ignore',windowsHide:true});opener.unref();}
 process.on('SIGINT',async()=>{await close();process.exit(0);});process.on('SIGTERM',async()=>{await close();process.exit(0);});
}catch(e){console.error('Local dashboard could not start:',e.message);await close();process.exitCode=1;}

