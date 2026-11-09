import {DatabaseSync} from 'node:sqlite';import {existsSync,openSync,closeSync,copyFileSync,constants,unlinkSync} from 'node:fs';import {resolve} from 'node:path';import {execFileSync} from 'node:child_process';
export function backupSQLite(source,destination){
 if(!existsSync(source)||resolve(source)===resolve(destination))throw Error('Choose an existing source and a different new backup path.');
 const fd=openSync(destination,'wx',0o600);closeSync(fd);let db;
 try{db=new DatabaseSync(source,{readOnly:true});db.exec("VACUUM INTO '"+destination.replaceAll("'","''")+"'");}catch(e){unlinkSync(destination);throw Error('SQLite backup failed.');}finally{db?.close();}
}
export function restoreSQLite(source,destination){
 if(!existsSync(source)||existsSync(destination))throw Error('Restore requires a backup and a new destination file.');const db=new DatabaseSync(source,{readOnly:true});try{if(db.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('Backup integrity check failed');}finally{db.close();}copyFileSync(source,destination,constants.COPYFILE_EXCL);
}
export function postgresBackup(destination,env=process.env){
 if(!env.DATABASE_URL||existsSync(destination))throw Error('Set DATABASE_URL and choose a new backup path.');
 try{execFileSync('pg_dump',['--format=custom','--file',destination],{env:{...env,PGDATABASE:env.DATABASE_URL},stdio:'pipe',windowsHide:true});}catch{throw Error('PostgreSQL backup failed. Inspect server/client connectivity. A partial output may remain; use a new path after review.');}
}
export function postgresRestore(source,env=process.env){
 if(!existsSync(source)||!env.RESTORE_DATABASE_URL||env.RESTORE_DATABASE_URL===env.DATABASE_URL)throw Error('Use an existing backup and a separate empty RESTORE_DATABASE_URL.');
 const url=new URL(env.RESTORE_DATABASE_URL),database=decodeURIComponent(url.pathname.slice(1));if(!['postgres:','postgresql:'].includes(url.protocol)||!database||!/^[A-Za-z0-9_.-]+$/.test(database))throw Error('Use a PostgreSQL URL with a simple explicit database name.');
 if(env.DATABASE_URL){const live=new URL(env.DATABASE_URL);if(live.hostname===url.hostname&&(live.port||'5432')===(url.port||'5432')&&live.pathname===url.pathname)throw Error('Restore must target a different database.');}
 const target={...env,PGDATABASE:database,PGHOST:url.hostname.replace(/^\[|\]$/g,''),PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password)};for(const key of ['sslmode','sslrootcert','sslcert','sslkey','connect_timeout','target_session_attrs','channel_binding'])if(url.searchParams.has(key))target['PG'+key.toUpperCase()]=url.searchParams.get(key);
 let count;try{count=execFileSync('psql',['--no-psqlrc','--no-password','--tuples-only','--no-align','--command',"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') AND table_schema NOT LIKE 'pg_toast%';"],{env:target,encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).trim();}catch{throw Error('Cannot verify restore destination is empty.');}
 if(count!=='0')throw Error('Restore destination must have no user tables.');
 try{execFileSync('pg_restore',['--dbname',database,'--no-password','--no-owner','--exit-on-error','--single-transaction',source],{env:target,stdio:'pipe',windowsHide:true});}catch{throw Error('PostgreSQL restore failed; inspect the isolated restore environment.');}
}
if(process.argv[1]?.endsWith('database-backup.mjs')){
 try{const [mode,source,dest]=process.argv.slice(2);if(mode==='sqlite-backup'&&source&&dest)backupSQLite(source,dest);else if(mode==='sqlite-restore'&&source&&dest)restoreSQLite(source,dest);else if(mode==='postgres-backup'&&source)postgresBackup(source);else if(mode==='postgres-restore'&&source&&dest==='--confirm-empty-target')postgresRestore(source);else throw Error('Use sqlite-backup SOURCE NEWFILE, sqlite-restore BACKUP NEWFILE, postgres-backup NEWFILE, or postgres-restore BACKUP --confirm-empty-target.');console.log('Database operation completed. Verify the restored application before acceptance.');}catch(e){console.error(e.message);process.exitCode=1;}
}
