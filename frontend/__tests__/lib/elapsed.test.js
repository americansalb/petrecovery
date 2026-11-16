/**
 * One count of days (app/lib/elapsed.js), so every screen gives the same
 * number for the same pet at the same moment.
 *
 * Testing found the pet's page said "Missing 2 days" while the search
 * screen's top line said "Lost 3 days ago", and on the desk the map's label
 * under an area said "2 days ago" while the Ground list said "3 days ago":
 * some counts rounded and some did not. A part of a day is not a day.
 */
import fs from 'fs';
import path from 'path';
import { wholeDays, DAY_MS } from '@/app/lib/elapsed';
import { caseTimeline, timeAgo } from '@/app/lib/caseLabels';
import { agoWords, situationLine } from '@/app/mission-control/lib/words';
import { agoShort, areaLine } from '@/app/mission-control/lib/ground';
import { missingFor } from '@/app/mission-control/lib/insight';

const NOW = new Date('2026-11-16T18:00:00Z').getTime();
const HOUR = 60 * 60 * 1000;

describe('wholeDays', () => {
  test('a part of a day is not a day, and nothing is ever negative', () => {
    expect(wholeDays(2 * DAY_MS + 20 * HOUR)).toBe(2);
    expect(wholeDays(3 * DAY_MS)).toBe(3);
    expect(wholeDays(23 * HOUR)).toBe(0);
    expect(wholeDays(-5 * DAY_MS)).toBe(0);
    expect(wholeDays(NaN)).toBe(0);
    expect(wholeDays(undefined)).toBe(0);
  });
});

describe('every screen says the same number of days for the same pet', () => {
  // Pip was lost two days and fourteen hours ago: past the half day that rounding turned into 3.
  const lostAt = new Date(NOW - (2 * DAY_MS + 14 * HOUR));

  test('the pet\'s page and the search screen\'s top line', () => {
    expect(caseTimeline({ status: 'ACTIVE', reportType: 'LOST', lastSeenAt: lostAt }, NOW)).toBe('Missing 2 days');
    const line = situationLine({ open: true, reunited: false, pet: { name: 'Pip' }, lastSeen: { at: lostAt, place: 'Burnet Rd' }, sightings: [] }, NOW);
    expect(line.text).toMatch(/^Lost 2 days ago near Burnet Rd\./);
    expect(agoWords(lostAt, NOW)).toBe('2 days ago');
    expect(timeAgo(lostAt, NOW)).toBe('2 days ago');
  });

  test('the desk\'s map label under an area, its Ground list and its "missing" figure', () => {
    const area = { key: 'north', name: 'North side', ring: 1, status: 'SEARCHED', searchCount: 1, searchedAt: lostAt, searchedByName: 'David' };
    expect(agoShort(lostAt, NOW)).toBe('2 days ago');
    expect(areaLine(area, { timeZone: 'America/Chicago', now: NOW })).toMatch(/^Searched once, 2 days ago /);
    expect(missingFor(lostAt, NOW)).toBe('2 days');
  });

  test('each of them counts days through the one helper, and none rounds days on its own', () => {
    const root = path.join(__dirname, '..', '..');
    for (const file of ['app/lib/caseLabels.js', 'app/mission-control/lib/words.js', 'app/mission-control/lib/ground.js', 'app/mission-control/lib/insight.js', 'app/lib/shareMetadata.js']) {
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      expect(source).toMatch(/import \{ wholeDays \} from '@\/app\/lib\/elapsed';/);
      expect(source).not.toMatch(/Math\.(round|floor|ceil)\([^)]*\/\s*(DAY|DAY_MS|86400000|\(24 \* HOUR(_MS)?\))\)/);
    }
  });
});
