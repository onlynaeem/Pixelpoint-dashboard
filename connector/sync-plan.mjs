export const defaultSync={mode:'interval',interval_seconds:300,daily_at:'02:00',lookback_days:8};
export function validateSync(input){
 if(!input||!['interval','daily'].includes(input.mode))throw Error('Select interval or daily synchronization.');
 if(!Number.isInteger(input.interval_seconds)||input.interval_seconds<30||input.interval_seconds>86400)throw Error('Interval must be a whole number from 30 to 86400 seconds.');
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.daily_at||''))throw Error('Daily time must use HH:MM.');
 if(!Number.isInteger(input.lookback_days)||input.lookback_days<1||input.lookback_days>366)throw Error('Lookback must be 1 to 366 days.');
 return Object.fromEntries(Object.keys(defaultSync).map(k=>[k,input[k]]));
}
export function parseRange(args){
 const values={};for(let i=0;i<args.length;i++){if(['--from','--to'].includes(args[i])){if(values[args[i]]!==undefined||!args[i+1]||args[i+1].startsWith('--'))throw Error('Supply each backfill date once.');values[args[i]]=args[++i];}}
 if(!Object.keys(values).length)return null;
 if(!values['--from']||!values['--to']||!args.includes('--once'))throw Error('Backfill requires --from YYYY-MM-DD --to YYYY-MM-DD --once.');
 return {from:values['--from'],to:values['--to']};
}
export function planDays(today,lookback,range=null){
 const date=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error('Use valid calendar dates in YYYY-MM-DD format.');return Date.parse(s+'T00:00:00Z');};
 const endToday=date(today);if(!Number.isInteger(lookback)||lookback<1||lookback>366)throw Error('Invalid lookback days');
 const start=range?date(range.from):endToday-(lookback-1)*86400000,end=range?date(range.to):endToday;
 if(start>end||end>endToday||(end-start)/86400000+1>366)throw Error('Backfill must be ordered, at most 366 days, and cannot include future dates.');
 return Array.from({length:(end-start)/86400000+1},(_,i)=>new Date(start+i*86400000).toISOString().slice(0,10));
}
