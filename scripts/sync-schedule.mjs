export function createSchedule(config) {
  if (!['interval', 'daily'].includes(config.mode)) throw Error('Invalid sync mode');
  if (!Number.isInteger(config.interval_seconds) || config.interval_seconds < 30) throw Error('Sync interval must be at least 30 seconds');
  if (config.mode === 'daily' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(config.daily_at || '')) throw Error('Invalid daily sync time');
  const format = new Intl.DateTimeFormat('en-CA', {timeZone: config.timezone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
  let lastAttempt = null, completedDay = '';
  const parts = now => Object.fromEntries(format.formatToParts(new Date(now)).map(p => [p.type, p.value]));
  return {
    attempted(now) { lastAttempt = now; },
    succeeded(now) { const p = parts(now); completedDay = p.year + p.month + p.day; },
    due(now) {
      if (lastAttempt !== null && now - lastAttempt < config.interval_seconds * 1000) return false;
      if (config.mode === 'interval') return true;
      const p = parts(now);
      return p.year + p.month + p.day !== completedDay && p.hour + ':' + p.minute >= config.daily_at;
    }
  };
}
