import {existsSync,statSync,renameSync,appendFileSync,unlinkSync,mkdirSync} from 'node:fs';import {join} from 'node:path';
export function recordEvent(directory,state){
 if(!['sync_started','sync_completed','sync_failed'].includes(state))throw Error('Unknown event state');mkdirSync(directory,{recursive:true});const path=join(directory,'events.jsonl');
 if(existsSync(path)&&statSync(path).size>=1048576){const oldest=path+'.3';if(existsSync(oldest))unlinkSync(oldest);for(let n=2;n>=1;n--)if(existsSync(path+'.'+n))renameSync(path+'.'+n,path+'.'+(n+1));renameSync(path,path+'.1');}
 appendFileSync(path,JSON.stringify({at:new Date().toISOString(),state})+'\n',{mode:0o600});
}
