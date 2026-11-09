import {randomBytes} from 'node:crypto';import {writeFileSync,mkdirSync} from 'node:fs';import {dirname} from 'node:path';
export function initializeConfig(path=process.env.CLOUD_CONFIG||'config/cloud.json'){
 mkdirSync(dirname(path),{recursive:true});const config={viewers:[],restaurants:[{id:'r1',tenant_id:'demo',name:'Sample Bahrain',country:'BH',currency:'BHD',timezone:'Asia/Bahrain',key:randomBytes(32).toString('hex')},{id:'r2',tenant_id:'demo',name:'Sample Saudi Arabia',country:'SA',currency:'SAR',timezone:'Asia/Riyadh',key:randomBytes(32).toString('hex')}]};
 writeFileSync(path,JSON.stringify(config,null,2),{flag:'wx',mode:0o600});return path;
}
if(process.argv[1]?.endsWith('init-config.mjs')){try{initializeConfig();console.log('Created local bootstrap configuration with unique random connector keys. Protect this file; do not commit it.');}catch(e){console.error(e.code==='EEXIST'?'Configuration already exists; it was not overwritten.':'Configuration initialization failed.');process.exitCode=1;}}
