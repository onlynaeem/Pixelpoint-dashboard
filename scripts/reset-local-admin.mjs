import {DatabaseSync} from 'node:sqlite';
import {passwordHash} from '../cloud/auth.mjs';
const password=process.env.LOCAL_RESET_PASSWORD; delete process.env.LOCAL_RESET_PASSWORD;
const email='admin@local.test'; const db=new DatabaseSync('local-live/live.db');
try {
 const row=db.prepare('SELECT id,payload FROM app_users WHERE email=?').get(email);
 if(!row) throw new Error('Administrator account not found.');
 const user=JSON.parse(row.payload); if(user.role!=='admin'||user.tenant_id!=='lab-naeem') throw new Error('Expected local administrator account not found.');
 user.password_hash=await passwordHash(password); user.token_version=(user.token_version||0)+1; user.must_change=false;
 db.exec('BEGIN IMMEDIATE');
 try {db.prepare('UPDATE app_users SET payload=? WHERE id=?').run(JSON.stringify(user),row.id);db.prepare('DELETE FROM app_sessions WHERE user_id=?').run(row.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 console.log('Password reset. Sign in as '+email+'.');
} finally {db.close();}
