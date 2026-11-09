import {readFileSync,writeFileSync,renameSync} from 'node:fs';
export function nextSequence(path,cloudFloor,now=Date.now()) {
 if(!Number.isSafeInteger(cloudFloor)||cloudFloor<0)throw Error('Invalid cloud sequence');
 let previous=0;
 try { const raw=readFileSync(path,'utf8').trim();if(!/^\d+$/.test(raw))throw Error('Invalid local sequence');previous=Number(raw); }
 catch(e){if(e.code!=='ENOENT')throw e;}
 if(!Number.isSafeInteger(previous)||previous<0)throw Error('Invalid local sequence');
 const next=Math.max(now,previous+1,cloudFloor+1);
 if(!Number.isSafeInteger(next)||next<1)throw Error('Sequence exhausted');
 writeFileSync(path+'.tmp',String(next));renameSync(path+'.tmp',path);return next;
}
