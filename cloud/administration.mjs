import {hash} from './core.mjs';
const conflict=()=>Object.assign(Error('Administration changed in another session. Reload and try again.'),{status:409});
export function bootstrapConfig(input){
 const config=structuredClone(input);if(!Array.isArray(config.restaurants)||!config.restaurants.length)throw Error('Configure at least one restaurant.');
 const ids=new Set();for(const r of config.restaurants){if(!r.id||!r.tenant_id||ids.has(r.id))throw Error('Invalid or duplicate restaurant');ids.add(r.id);if(r.key){if(typeof r.key!=='string'||r.key.length<24)throw Error('Use connector keys of at least 24 characters');r.needs_key_rotation=r.key.length<32||/demo|change|replace/i.test(r.key);r.key_hash=hash(r.key);delete r.key;}if(!/^[a-f0-9]{64}$/.test(r.key_hash||''))throw Error('Missing connector key hash');}return config;
}
export function sqliteAdministration(db){
 db.exec('CREATE TABLE IF NOT EXISTS administration(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL,payload TEXT NOT NULL)');
 const seed=config=>{for(const r of config.restaurants)db.prepare('INSERT OR REPLACE INTO restaurants VALUES(?,?)').run(r.id,JSON.stringify({id:r.id,tenant_id:r.tenant_id,name:r.name,currency:r.currency,timezone:r.timezone,key_hash:r.key_hash}));};
 return {
 async initialize(input){db.exec('BEGIN IMMEDIATE');try{if(!db.prepare('SELECT id FROM administration WHERE id=1').get()){const config=bootstrapConfig(input);db.prepare('INSERT INTO administration VALUES(1,1,?)').run(JSON.stringify(config));seed(config);}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}},
 async load(){const r=db.prepare('SELECT version,payload FROM administration WHERE id=1').get();return {version:r.version,config:JSON.parse(r.payload)};},
 async save(config,version,event=null){config=bootstrapConfig(config);db.exec('BEGIN IMMEDIATE');try{const result=db.prepare('UPDATE administration SET version=version+1,payload=? WHERE id=1 AND version=?').run(JSON.stringify(config),version);if(!result.changes)throw conflict();seed(config);if(event)db.prepare('INSERT INTO auth_audit(id,tenant_id,payload) VALUES(?,?,?)').run(event.id,event.tenant_id,JSON.stringify(event));db.exec('COMMIT');return version+1;}catch(e){db.exec('ROLLBACK');throw e;}}
 };
}
export async function pgAdministration(pool){
 await pool.query('CREATE TABLE IF NOT EXISTS administration(id integer PRIMARY KEY CHECK(id=1),version bigint NOT NULL,payload jsonb NOT NULL)');
 const seed=async(client,config)=>{for(const r of config.restaurants)await client.query('INSERT INTO restaurants(id,tenant_id,name,currency,timezone,key_hash) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET tenant_id=$2,name=$3,currency=$4,timezone=$5,key_hash=$6',[r.id,r.tenant_id,r.name,r.currency,r.timezone,r.key_hash]);};
 return {
 async initialize(input){const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(1860417)');const current=await c.query('SELECT id FROM administration WHERE id=1');if(!current.rowCount){const config=bootstrapConfig(input);await c.query('INSERT INTO administration VALUES(1,1,$1)',[config]);await seed(c,config);}await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}},
 async load(){const r=(await pool.query('SELECT version,payload FROM administration WHERE id=1')).rows[0];return {version:Number(r.version),config:r.payload};},
 async save(config,version,event=null){config=bootstrapConfig(config);const c=await pool.connect();try{await c.query('BEGIN');const r=await c.query('UPDATE administration SET version=version+1,payload=$1 WHERE id=1 AND version=$2 RETURNING version',[config,version]);if(!r.rowCount)throw conflict();await seed(c,config);if(event)await c.query('INSERT INTO auth_audit(id,tenant_id,payload) VALUES($1,$2,$3)',[event.id,event.tenant_id,event]);await c.query('COMMIT');return Number(r.rows[0].version);}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 };
}
