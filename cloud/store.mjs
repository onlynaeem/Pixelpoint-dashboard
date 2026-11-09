import {pgAuth,sqliteAuth} from './auth-store.mjs';
import {pgAdministration,sqliteAdministration} from './administration.mjs';
import {readFileSync} from 'node:fs';
export async function openStore(){
 if(process.env.DATABASE_URL){
 const {Pool}=await import('pg');const pool=new Pool({connectionString:process.env.DATABASE_URL});
 await pool.query(readFileSync(new URL('../db/001_init.sql',import.meta.url),'utf8'));
 return {
 auth:await pgAuth(pool),
 administration:await pgAdministration(pool),
 async connectorStates(ids){return (await pool.query('SELECT restaurant_id,MAX(received_at) AS last_received_at,MAX(day)::text AS latest_day,MAX(sequence) AS sequence,COUNT(*) AS snapshot_days FROM snapshots WHERE restaurant_id=ANY($1::text[]) GROUP BY restaurant_id',[ids])).rows.map(r=>({...r,last_received_at:new Date(r.last_received_at).toISOString(),sequence:Number(r.sequence)}));},
 async seed(r){await pool.query('INSERT INTO restaurants VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET tenant_id=$2,name=$3,currency=$4,timezone=$5,key_hash=$6',Object.values(r));},
 async restaurants(){return (await pool.query('SELECT * FROM restaurants')).rows;},
 async put(id,p){const r=await pool.query('INSERT INTO snapshots(restaurant_id,day,sequence,payload) VALUES($1,$2,$3,$4) ON CONFLICT(restaurant_id,day) DO UPDATE SET sequence=$3,payload=$4,received_at=now() WHERE snapshots.sequence < $3 RETURNING sequence',[id,p.day,p.sequence,p]);return r.rowCount>0;},
 async get(ids,from,to){return (await pool.query('SELECT restaurant_id,payload,received_at FROM snapshots WHERE restaurant_id=ANY($1::text[]) AND day >= $2 AND day <= $3 ORDER BY day',[ids,from,to])).rows.map(r=>({...r.payload,restaurant_id:r.restaurant_id,received_at:r.received_at}));},
 close:()=>pool.end()};
 }
 if(process.env.DEMO!=='true')throw Error('DATABASE_URL required (or DEMO=true for local testing)');
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(process.env.DEMO_DB||'demo.db');
 db.exec('CREATE TABLE IF NOT EXISTS restaurants(id TEXT PRIMARY KEY,payload TEXT);CREATE TABLE IF NOT EXISTS snapshots(id TEXT,day TEXT,sequence INTEGER,payload TEXT,received_at TEXT,PRIMARY KEY(id,day));');
 return {
 auth:sqliteAuth(db),
 administration:sqliteAdministration(db),
 async connectorStates(ids){const allowed=new Set(ids);return db.prepare('SELECT id AS restaurant_id,MAX(received_at) AS last_received_at,MAX(day) AS latest_day,MAX(sequence) AS sequence,COUNT(*) AS snapshot_days FROM snapshots GROUP BY id').all().filter(r=>allowed.has(r.restaurant_id));},
 async seed(r){db.prepare('INSERT OR REPLACE INTO restaurants VALUES(?,?)').run(r.id,JSON.stringify(r));},
 async restaurants(){return db.prepare('SELECT payload FROM restaurants').all().map(r=>JSON.parse(r.payload));},
 async put(id,p){return db.prepare('INSERT INTO snapshots VALUES(?,?,?,?,?) ON CONFLICT(id,day) DO UPDATE SET sequence=excluded.sequence,payload=excluded.payload,received_at=excluded.received_at WHERE excluded.sequence>snapshots.sequence').run(id,p.day,p.sequence,JSON.stringify(p),new Date().toISOString()).changes>0;},
 async get(ids,from,to){return db.prepare('SELECT * FROM snapshots WHERE day>=? AND day<=? ORDER BY day').all(from,to).filter(r=>ids.includes(r.id)).map(r=>({...JSON.parse(r.payload),restaurant_id:r.id,received_at:r.received_at}));},
 close:()=>db.close()};
}
