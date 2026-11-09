import {readFileSync} from 'node:fs';
export function checkConfig(config,env=process.env){
 const issues=[],ids=new Set(),keys=new Set();
 if(!Array.isArray(config.restaurants)||!config.restaurants.length)issues.push('Configure at least one restaurant.');
 for(const r of config.restaurants||[]){
  if(typeof r.id!=='string'||!r.id||ids.has(r.id))issues.push('Restaurant IDs must be unique nonempty strings.');ids.add(r.id);
  if(!r.name||!r.tenant_id)issues.push('Every restaurant needs a name and tenant ID.');
  if(!/^[A-Z]{3}$/.test(r.currency||''))issues.push('Each restaurant needs a three-letter currency.');
  try{new Intl.DateTimeFormat('en',{timeZone:r.timezone||'INVALID'});}catch{issues.push('Each restaurant needs a valid timezone.');}
  const credential=r.key_hash||r.key;const valid=r.key_hash?/^[a-f0-9]{64}$/.test(r.key_hash)&&r.needs_key_rotation!==true:typeof r.key==='string'&&r.key.length>=32&&!/demo|change|replace/i.test(r.key);
  if(!valid||keys.has(credential))issues.push('Use a unique production connector key of at least 32 characters per store.');keys.add(credential);
 }
 if(env.DEMO==='true')issues.push('Disable DEMO for cloud deployment.');
 if(!env.DATABASE_URL?.startsWith('postgres'))issues.push('Set DATABASE_URL for PostgreSQL.');
 if(env.ALLOW_LEGACY_TOKENS==='true')issues.push('Disable legacy viewer tokens.');
 if(env.SESSION_SECURE==='false')issues.push('Enable secure session cookies for HTTPS.');
 return [...new Set(issues)];
}
if(process.argv[1]?.endsWith('check-cloud-config.mjs')){
 try{let cfg;if(process.argv.includes('--database')){const {openStore}=await import('../cloud/store.mjs');const store=await openStore();try{cfg=(await store.administration.load()).config;}finally{await store.close();}}else cfg=JSON.parse(readFileSync(process.env.CLOUD_CONFIG||'config/cloud.json','utf8').replace(/^\uFEFF/,''));const issues=checkConfig(cfg);for(const issue of issues)console.log('CHECK: '+issue);console.log(issues.length?'Configuration needs attention.':'Configuration checks passed. HTTPS, database connectivity, backup and live acceptance still require deployment tests.');process.exitCode=issues.length?1:0;}catch{console.error('Cannot read cloud configuration.');process.exitCode=1;}
}
