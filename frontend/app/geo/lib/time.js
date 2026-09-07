/** "just now", "5 min ago", "3 h ago", "2 days ago": for lists of recent things. */
export function ago(ms, now = Date.now()) {
  const diff = Math.max(0, now - (Number(ms) || 0));
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
