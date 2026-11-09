export function monitorRows(restaurants,states,now=Date.now()) {
 const byId=new Map(states.map(s=>[s.restaurant_id,s]));
 return restaurants.map(r=>{
  const s=byId.get(r.id),age=s?.last_received_at?Math.max(0,Math.floor((now-Date.parse(s.last_received_at))/1000)):null;
  return {restaurant_id:r.id,name:r.name,currency:r.currency,timezone:r.timezone,uploads_enabled:r.active!==false,last_received_at:s?.last_received_at||null,latest_day:s?.latest_day||null,sequence:Number(s?.sequence||0),snapshot_days:Number(s?.snapshot_days||0),age_seconds:age,status:r.active===false?'uploads_paused':age===null?'never_synced':age>900?'stale':'recent'};
 });
}
