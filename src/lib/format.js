export const pct = (x, digits = 0) => `${(x * 100).toFixed(digits)}%`;

export function clock(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return h ? `${h}:${mm}:${String(r).padStart(2, '0')}` : `${mm}:${String(r).padStart(2, '0')}`;
}

export function duration(sec) {
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

export function relDate(ts, now = Date.now()) {
  const d = new Date(ts);
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / 86400000);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + `, ${time}`;
}

export const marks = (m) => (Number.isInteger(m) ? String(m) : m.toFixed(2).replace(/0$/, ''));

export const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;

export function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 5 ? 'Late night revision' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
