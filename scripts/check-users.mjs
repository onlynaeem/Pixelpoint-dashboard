import {existsSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const path=process.argv[2];if(!existsSync(path)){console.log('false');process.exit(0);}const db=new DatabaseSync(path,{readOnly:true});
try{const table=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_users'").get();console.log(table&&db.prepare('SELECT count(*) AS n FROM app_users').get().n>0?'true':'false');}finally{db.close();}

