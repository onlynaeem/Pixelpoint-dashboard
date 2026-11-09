import {readFileSync} from 'node:fs';
const parse=x=>typeof x==='string'?JSON.parse(x):x;
function patched(current,changes,users){
 if(!current)throw Object.assign(Error('User not found'),{status:404});
 const {invalidate,...patch}=changes,next={...current,...patch};
 if(invalidate)next.token_version=(current.token_version||0)+1;
 if(current.role==='admin'&&current.active&&(!next.active||next.role!=='admin')&&users.filter(u=>u.active&&u.role==='admin').length<=1)throw Object.assign(Error('Keep at least one active brand administrator.'),{status:409});
 return next;
}
function common(run,mutate){
 return {
 async users(tenant){return (await run('SELECT payload FROM app_users WHERE tenant_id=?',[tenant])).rows.map(r=>parse(r.payload));},
 async byEmail(email){const r=(await run('SELECT payload FROM app_users WHERE email=?',[email])).rows[0];return r?parse(r.payload):null;},
 async byId(id){const r=(await run('SELECT payload FROM app_users WHERE id=?',[id])).rows[0];return r?parse(r.payload):null;},
 async create(user){await run('INSERT INTO app_users(id,email,tenant_id,payload) VALUES(?,?,?,?)',[user.id,user.email,user.tenant_id,JSON.stringify(user)]);return user;},
 update:mutate,
 async addSession(session){await run('INSERT INTO app_sessions(token_hash,user_id,expires,payload) VALUES(?,?,?,?)',[session.token_hash,session.user_id,session.expires,JSON.stringify(session)]);},
 async session(key){const r=(await run('SELECT payload FROM app_sessions WHERE token_hash=?',[key])).rows[0];return r?parse(r.payload):null;},
 async revokeSession(key){await run('DELETE FROM app_sessions WHERE token_hash=?',[key]);},
 async revokeUser(id){await run('DELETE FROM app_sessions WHERE user_id=?',[id]);},
 async clean(now){await run('DELETE FROM app_sessions WHERE expires<?',[now]);await run('DELETE FROM login_attempts WHERE reset_at<?',[now]);},
 async attempt(key,now){await run('INSERT INTO login_attempts(attempt_key,count,reset_at) VALUES(?,1,?) ON CONFLICT(attempt_key) DO UPDATE SET count=CASE WHEN login_attempts.reset_at<? THEN 1 ELSE login_attempts.count+1 END,reset_at=CASE WHEN login_attempts.reset_at<? THEN ? ELSE login_attempts.reset_at END',[key,now+600000,now,now,now+600000]);return Number((await run('SELECT count FROM login_attempts WHERE attempt_key=?',[key])).rows[0].count);},
 async clearAttempt(key){await run('DELETE FROM login_attempts WHERE attempt_key=?',[key]);},
 async audit(event){await run('INSERT INTO auth_audit(id,tenant_id,payload) VALUES(?,?,?)',[event.id,event.tenant_id,JSON.stringify(event)]);},
 async audits(tenant){return (await run('SELECT payload FROM auth_audit WHERE tenant_id=? ORDER BY id DESC LIMIT 200',[tenant])).rows.map(r=>parse(r.payload));}
 };
}
export async function pgAuth(pool){
 await pool.query(readFileSync(new URL('../db/002_auth.sql',import.meta.url),'utf8'));
 const run=async(sql,params=[])=>{let n=0;return pool.query(sql.replaceAll('?',()=>'$'+(++n)),params);};
 return common(run,async(tenant,id,changes)=>{
 const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[tenant]);
 const users=(await client.query('SELECT payload FROM app_users WHERE tenant_id=$1',[tenant])).rows.map(r=>parse(r.payload));
 const next=patched(users.find(u=>u.id===id),changes,users);
 await client.query('UPDATE app_users SET payload=$1 WHERE id=$2 AND tenant_id=$3',[JSON.stringify(next),id,tenant]);await client.query('COMMIT');return next;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}});
}
export function sqliteAuth(db){
 db.exec(readFileSync(new URL('../db/002_auth_sqlite.sql',import.meta.url),'utf8'));
 const run=async(sql,params=[])=>sql.trim().startsWith('SELECT')?{rows:db.prepare(sql).all(...params)}:{rowCount:db.prepare(sql).run(...params).changes};
 return common(run,async(tenant,id,changes)=>{
 db.exec('BEGIN IMMEDIATE');try{
 const users=db.prepare('SELECT payload FROM app_users WHERE tenant_id=?').all(tenant).map(r=>parse(r.payload));
 const next=patched(users.find(u=>u.id===id),changes,users);
 db.prepare('UPDATE app_users SET payload=? WHERE id=? AND tenant_id=?').run(JSON.stringify(next),id,tenant);db.exec('COMMIT');return next;
 }catch(e){db.exec('ROLLBACK');throw e;}});
}

