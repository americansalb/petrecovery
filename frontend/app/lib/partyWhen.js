/**
 * When a search party meets, in words: "Saturday, 9 am", "Sunday, 2:30 pm".
 * Shared by the search party card and the push that announces a party.
 */
export function partyWhen(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US', { weekday: 'long' });
  const h = d.getHours();
  const m = d.getMinutes();
  return `${day}, ${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}
