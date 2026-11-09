import {scrypt as rawScrypt,randomBytes,randomUUID,timingSafeEqual,createHash} from 'node:crypto';import {promisify} from 'node:util';
const scrypt=promisify(rawScrypt),sha=s=>createHash('sha256').update(s).digest('hex');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export function passwordPolicy(value){if(typeof value!=='string'||value.length<12||value.length>128)fail('Password must contain 12 to 128 characters.');}
export async function passwordHash(value){passwordPolicy(value);const salt=randomBytes(16).toString('hex'),key=await scrypt(value,salt,64,{N:16384,r:8,p:1});return 'scrypt$'+salt+'$'+key.toString('hex');}
export async function verifyPassword(value,encoded){if(typeof value!=='string'||value.length>128)return false;const [name,salt,digest]=String(encoded||'').split('$');if(name!=='scrypt'||!salt||!digest||digest.length!==128)return false;const key=await scrypt(value,salt,64,{N:16384,r:8,p:1}),expected=Buffer.from(digest,'hex');return expected.length===key.length&&timingSafeEqual(key,expected);}
const publicUser=({id,email,tenant_id,name,role,restaurant_ids,active,must_change,created_at})=>({id,email,tenant_id,name,role,restaurant_ids,active,must_change,created_at});
export const normalizeEmail=value=>String(value||'').trim().toLowerCase();
export function scopeUser(user,restaurants){return restaurants.filter(r=>r.tenant_id===user.tenant_id&&(user.role==='admin'||user.restaurant_ids==='*'||user.restaurant_ids.includes(r.id)));}
function membership(role,ids,restaurants,tenant){
 if(!['admin','manager','viewer'].includes(role))fail('Unknown user role.');
 if(role==='admin')return '*';
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!restaurants.some(r=>r.id===id&&r.tenant_id===tenant)))fail('Assign at least one restaurant belonging to this brand.');
 return ids;
}
export async function createAuth(repo,config){
 const secure=process.env.SESSION_SECURE==='true'||(process.env.DEMO!=='true'&&process.env.SESSION_SECURE!=='false');
 const dummy=await passwordHash(randomBytes(24).toString('hex'));
 const audit=async(tenant,actor,action,target)=>repo.audit({id:Date.now().toString().padStart(16,'0')+'-'+randomUUID(),tenant_id:tenant,actor,action,target,at:new Date().toISOString()});
 if(process.env.ADMIN_EMAIL&&process.env.ADMIN_PASSWORD){
 const tenant=process.env.BOOTSTRAP_TENANT_ID||config.restaurants[0]?.tenant_id;
 if(!config.restaurants.some(r=>r.tenant_id===tenant))fail('Bootstrap brand has no configured restaurants.');
 if(!(await repo.users(tenant)).length){const email=normalizeEmail(process.env.ADMIN_EMAIL);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Invalid administrator email.');
 const user={id:randomUUID(),email,tenant_id:tenant,name:'Brand Administrator',role:'admin',restaurant_ids:'*',active:true,must_change:false,token_version:1,password_hash:await passwordHash(process.env.ADMIN_PASSWORD),created_at:new Date().toISOString()};await repo.create(user);await audit(tenant,user.id,'bootstrap_admin',user.id);}
 }
 delete process.env.ADMIN_PASSWORD;
 await repo.clean(Date.now());
 const cookie=(value,age)=>'pp_session='+value+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+age+(secure?'; Secure':'');
 async function session(req){const raw=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('pp_session='))?.slice(11);if(!raw||!/^[a-f0-9]{64}$/.test(raw))return null;const s=await repo.session(sha(raw));if(!s||s.expires<=Date.now())return null;const user=await repo.byId(s.user_id);if(!user||!user.active||s.version!==user.token_version)return null;return {user,session:s};}
 function checkOrigin(req){if(!req.headers.origin)return;let origin;try{origin=new URL(req.headers.origin);}catch{fail('Origin rejected',403);}if(process.env.PUBLIC_ORIGIN?origin.origin!==new URL(process.env.PUBLIC_ORIGIN).origin:origin.host!==req.headers.host)fail('Origin rejected',403);}
 function csrf(req,state){checkOrigin(req);if(!state||typeof req.headers['x-csrf-token']!=='string'||req.headers['x-csrf-token']!==state.session.csrf)fail('Invalid security token. Refresh and sign in again.',403);}
 async function login(req,body,res){
 checkOrigin(req);const email=normalizeEmail(body.email),ip=req.socket?.remoteAddress||'local',attemptKey=sha(email+'|'+ip);
 if(await repo.attempt(attemptKey,Date.now())>10)fail('Too many sign-in attempts. Try again after 10 minutes.',429);
 const user=await repo.byEmail(email),valid=await verifyPassword(body.password,user?.password_hash||dummy);
 if(!user||!valid||!user.active)fail('Email or password is incorrect.',401);
 await repo.clearAttempt(attemptKey);const token=randomBytes(32).toString('hex'),csrfToken=randomBytes(32).toString('hex'),expires=Date.now()+8*3600000;
 await repo.addSession({token_hash:sha(token),user_id:user.id,version:user.token_version,csrf:csrfToken,expires});res.setHeader('Set-Cookie',cookie(token,8*3600));await audit(user.tenant_id,user.id,'login',user.id);
 return {user:publicUser(user),csrf:csrfToken};
 }
 async function logout(req,state,res){if(state){csrf(req,state);await repo.revokeSession(state.session.token_hash);}res.setHeader('Set-Cookie',cookie('',0));return {ok:true};}
 async function changePassword(req,state,body,res){csrf(req,state);if(!await verifyPassword(body.current_password,state.user.password_hash))fail('Current password is incorrect.',400);
 const password_hash=await passwordHash(body.new_password);await repo.update(state.user.tenant_id,state.user.id,{password_hash,must_change:false,invalidate:true});await repo.revokeUser(state.user.id);res.setHeader('Set-Cookie',cookie('',0));await audit(state.user.tenant_id,state.user.id,'change_password',state.user.id);return {ok:true,sign_in_again:true};}
 async function users(state){return (await repo.users(state.user.tenant_id)).map(publicUser);}
 async function addUser(req,state,body,restaurants){csrf(req,state);const email=normalizeEmail(body.email);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Enter a valid email.');
 if(typeof body.name!=='string'||!body.name.trim()||body.name.length>120)fail('User name is required (up to 120 characters).');
 const role=body.role,restaurant_ids=membership(role,body.restaurant_ids,restaurants,state.user.tenant_id);
 const user={id:randomUUID(),email,tenant_id:state.user.tenant_id,name:body.name.trim(),role,restaurant_ids,active:true,must_change:true,token_version:1,password_hash:await passwordHash(body.password),created_at:new Date().toISOString()};
 try{await repo.create(user);}catch(e){if(e.code==='23505'||e.code==='ERR_SQLITE_ERROR')fail('Could not create user; this email may already exist.',409);throw e;}await audit(user.tenant_id,state.user.id,'create_user',user.id);return publicUser(user);}
 async function updateUser(req,state,id,body,restaurants){csrf(req,state);const existing=await repo.byId(id);if(!existing||existing.tenant_id!==state.user.tenant_id)fail('User not found.',404);
 const changes={};if('name'in body){if(typeof body.name!=='string'||!body.name.trim()||body.name.length>120)fail('Invalid user name.');changes.name=body.name.trim();}
 if('role'in body||'restaurant_ids'in body){changes.role=body.role||existing.role;changes.restaurant_ids=membership(changes.role,body.restaurant_ids||existing.restaurant_ids,restaurants,state.user.tenant_id);changes.invalidate=true;}
 if('active'in body){if(typeof body.active!=='boolean')fail('Active must be true or false.');changes.active=body.active;changes.invalidate=true;}
 if(state.user.id===id&&(changes.active===false||(changes.role&&changes.role!=='admin')))fail('Another administrator must change your own administrator access.',409);
 const user=await repo.update(state.user.tenant_id,id,changes);if(changes.invalidate)await repo.revokeUser(id);await audit(user.tenant_id,state.user.id,'update_user',id);return publicUser(user);}
 async function resetPassword(req,state,id,body){csrf(req,state);const existing=await repo.byId(id);if(!existing||existing.tenant_id!==state.user.tenant_id)fail('User not found.',404);if(id===state.user.id)fail('Use Change password for your own account.');
 const password_hash=await passwordHash(body.password);await repo.update(state.user.tenant_id,id,{password_hash,must_change:true,invalidate:true});await repo.revokeUser(id);await audit(state.user.tenant_id,state.user.id,'reset_password',id);return {ok:true};}
 return {session,login,logout,changePassword,users,addUser,updateUser,resetPassword,csrf,publicUser,audits:state=>repo.audits(state.user.tenant_id)};
}

