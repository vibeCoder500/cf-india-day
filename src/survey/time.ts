// Deadlines are shown in IST for everyone: the org is in India, and visitors from abroad still get one unambiguous time.
export const istDateTime = (ms: number) =>
  `${new Date(ms).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} IST`;

// Rounded up to the minute, then split, so "2 days 23 h 59 min" left reads "3 days", not "2 days".
export function timeLeft(ms: number): string {
  if (ms <= 0) return 'closed';
  const m = Math.ceil(ms / 60_000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h${m % 60 ? ` ${m % 60} min` : ''}`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'}${h % 24 ? ` ${h % 24} h` : ''}`;
}
