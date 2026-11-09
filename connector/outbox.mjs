import {readdirSync,lstatSync,readFileSync,unlinkSync} from 'node:fs';import {join} from 'node:path';import {validate} from '../cloud/core.mjs';
export function queuedFiles(directory){return readdirSync(directory).filter(name=>name.endsWith('.json')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));}
export function checkQueueCapacity(directory,additionalBytes,maxBytes=268435456){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<26214400||!Number.isSafeInteger(additionalBytes)||additionalBytes<0)throw Error('Invalid queue capacity settings.');
 const bytes=readdirSync(directory).reduce((n,name)=>{const s=lstatSync(join(directory,name));return n+(s.isFile()?s.size:0);},0);
 if(bytes+additionalBytes>maxBytes)throw Error('Queue disk limit reached; no queued data was deleted. Resolve upload failures or increase max_outbox_bytes.');return {bytes,maxBytes};
}
export function readQueued(directory,name){
 const path=join(directory,name),stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>25*1024*1024)throw Error('Invalid queued snapshot file or size.');
 let payload;try{payload=JSON.parse(readFileSync(path,'utf8'));validate(payload);}catch{throw Error('Invalid queued snapshot; retained for operator review.');}return payload;
}
export async function flushOutbox({directory,api,key,restaurantId,send=fetch}){
 let acknowledged=0;for(const name of queuedFiles(directory)){
 const payload=readQueued(directory,name);const response=await send(new URL('/api/ingest',api),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key,'X-Restaurant-Id':restaurantId},body:JSON.stringify(payload),signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw Error('Upload HTTP '+response.status+'; queued snapshot retained.');
 let ack;try{ack=await response.json();}catch{throw Error('Invalid upload acknowledgement; queued snapshot retained.');}
 if(ack?.accepted!==true||typeof ack.changed!=='boolean')throw Error('Invalid upload acknowledgement; queued snapshot retained.');
 unlinkSync(join(directory,name));acknowledged++;
 }return acknowledged;
}
