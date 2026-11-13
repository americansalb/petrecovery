/**
 * The record of a search of an area, and what it is still worth.
 *
 * Founder, 2026-11-13, on the live desk: "You can mark an area as searched
 * but never know when it was searched etc? does it not fade over time?"
 * and "A real search and rescue team would find this superficial and
 * comical". What a search manager asks of every search of every area is
 * when, by whom, for how long, how much of it was covered and what could
 * not be reached, and a search of ground a pet can walk back onto does not
 * stay good.
 */
import fs from 'fs';
import path from 'path';
import { agoShort, areaState, groundCoverage, isFaded, searchLog, searchStrength, FADE_HOURS } from '@/app/mission-control/lib/ground';

const read = (file) => fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');
const NOW = new Date('2026-11-13T18:00:00Z').getTime();
const ago = (hours) => new Date(NOW - hours * 3600000).toISOString();
const area = (history, more = {}) => ({ id: 'z', key: 'north', ring: 1, name: 'North side', minutes: 45, status: 'SEARCHED', searchCount: history.length, searchedAt: history[0]?.at || null, history, ...more });
const full = (hours, more = {}) => ({ at: ago(hours), marked: false, minutes: 40, covered: 'ALL', ...more });

describe('how long ago, short enough for the map', () => {
  test('minutes, hours, yesterday, days', () => {
    expect(agoShort(ago(0.01), NOW)).toBe('just now');
    expect(agoShort(ago(0.2), NOW)).toBe('12 min ago');
    expect(agoShort(ago(3), NOW)).toBe('3 h ago');
    expect(agoShort(ago(30), NOW)).toBe('yesterday');
    expect(agoShort(ago(50), NOW)).toBe('2 days ago');
    expect(agoShort(null, NOW)).toBe('');
  });

  test('a searched area says when in its state, once the time is known', () => {
    expect(areaState(area([full(3)]), NOW)).toBe('Searched 3 h ago');
    expect(areaState(area([full(30)]), NOW)).toBe('Searched yesterday');
    expect(areaState(area([full(3)]))).toBe('Searched once');
    expect(areaState(area([full(3)], { status: 'NEEDS_REVISIT' }), NOW)).toBe('Another look');
  });
});

describe('what a search is still worth', () => {
  test('one full search just made counts for most, and never for everything', () => {
    const fresh = searchStrength(area([full(0)]), NOW);
    expect(fresh).toBeCloseTo(0.8, 2);
    expect(fresh).toBeLessThan(1);
  });

  test('it fades with the hours and is nothing after a day', () => {
    const at = (hours) => searchStrength(area([full(hours)]), NOW);
    expect(at(6)).toBeLessThan(at(1));
    expect(at(12)).toBeCloseTo(0.4, 2);
    expect(at(FADE_HOURS)).toBe(0);
    expect(at(40)).toBe(0);
    expect(FADE_HOURS).toBe(24);
  });

  test('covering part of it counts for less than covering all of it', () => {
    const of = (covered) => searchStrength(area([full(1, { covered })]), NOW);
    expect(of('ALL')).toBeGreaterThan(of('MOST'));
    expect(of('MOST')).toBeGreaterThan(of('PART'));
    // Nobody said: a little under "most of it".
    expect(of(null)).toBeLessThan(of('MOST'));
    expect(of(null)).toBeGreaterThan(of('PART'));
  });

  test('five minutes on an area that takes forty-five counts for little', () => {
    const quick = searchStrength(area([full(1, { minutes: 5 })]), NOW);
    const proper = searchStrength(area([full(1, { minutes: 40 })]), NOW);
    expect(quick).toBeLessThan(proper / 3);
  });

  test('two searches count for more than one, and still not for everything', () => {
    const one = searchStrength(area([full(1)]), NOW);
    const two = searchStrength(area([full(1), full(2)]), NOW);
    expect(two).toBeGreaterThan(one);
    expect(two).toBeLessThan(1);
  });

  test('ground put down from the desk counts, with how fully unknown', () => {
    const put = searchStrength(area([{ at: ago(1), marked: true, minutes: null, covered: null }]), NOW);
    expect(put).toBeGreaterThan(0.3);
    expect(put).toBeLessThan(searchStrength(area([full(1)]), NOW));
  });

  test('an area from before each search was kept is read from its last search', () => {
    expect(searchStrength({ minutes: 45, searchCount: 1, searchedAt: ago(1), history: [] }, NOW)).toBeGreaterThan(0.3);
    expect(searchStrength({ minutes: 45, searchCount: 0, searchedAt: null }, NOW)).toBe(0);
  });

  test('searched a day or more ago, with nobody on it, has faded', () => {
    expect(isFaded(area([full(25)]), NOW)).toBe(true);
    expect(isFaded(area([full(23)]), NOW)).toBe(false);
    expect(isFaded(area([full(25)], { status: 'IN_PROGRESS' }), NOW)).toBe(false);
    const areas = [area([full(25)], { id: 'a' }), area([full(2)], { id: 'b', key: 'east' }), { id: 'c', key: 'south', ring: 1, minutes: 45, status: 'UNSEARCHED', searchCount: 0 }];
    expect(groundCoverage(areas, NOW)).toMatchObject({ searched: 2, faded: 1 });
  });
});

describe('the record of an area', () => {
  test('a helper\'s search: when, who, how long, how much, and what they could not get to', () => {
    const [line] = searchLog(area([full(3, { by: 'Dana', minutes: 38, covered: 'MOST', note: 'yards on Elm, nobody home' })]), { timeZone: 'UTC', now: NOW });
    expect(line).toBe('3 hours ago, at 3:00 pm: Dana, 38 minutes, covered most of it. Could not get to: "yards on Elm, nobody home"');
  });

  test('a search far shorter than the area takes says what the area takes', () => {
    const [line] = searchLog(area([full(1, { by: 'Sam', minutes: 9, covered: null })]), { timeZone: 'UTC', now: NOW });
    expect(line).toBe('1 hour ago, at 5:00 pm: Sam, 9 minutes. The area takes about 45.');
  });

  test('ground put down from the desk says nobody on the site was on it', () => {
    const [line] = searchLog(area([{ at: ago(6), marked: true, minutes: null, covered: null, by: 'Kevin' }]), { timeZone: 'UTC', now: NOW });
    expect(line).toBe('6 hours ago, at 12:00 pm: put down as searched by Kevin. Nobody on the site was on it, so how long and how fully is not known.');
  });

  test('without names it still says when and how long, and names nobody', () => {
    const [line] = searchLog(area([full(2, { minutes: 30 })]), { timeZone: 'UTC', now: NOW });
    expect(line).toBe('2 hours ago, at 4:00 pm: A helper, 30 minutes, covered all of it.');
  });

  test('newest first, one line to a search', () => {
    expect(searchLog(area([full(1), full(5), full(26)]), { timeZone: 'UTC', now: NOW })).toHaveLength(3);
  });
});

describe('where it is kept and who is sent it', () => {
  const zones = read('app/lib/searchZones.js');
  const route = read('app/api/mission/[missionId]/board/route.js');

  test('ground put down from the desk is kept as a search of its own, with no start', () => {
    expect(zones).toMatch(/\.create\(\{ data: \{ zoneId: before\.id, caseId, searcherId: `\$\{MARK\}\$\{searcher\.userId\}`, searcherName: searcher\.firstName, endedAt: when, outcome: 'MARKED' \} \}\)/);
  });

  test('the board sends each area its last searches: when, how long, how much, and who only where names go', () => {
    expect(zones).toMatch(/where: \{ caseId, outcome: \{ in: \['SEARCHED', 'MARKED'\] \}, endedAt: \{ not: null \} \}/);
    expect(zones).toMatch(/history: historyOf\(row, ctx\),/);
    expect(zones).toMatch(/\.\.\.\(withNames \? \{ by: v\.searcherName \|\| null, note: v\.debrief \|\| null \} : \{\}\)/);
    // A helper who forgot to say for hours is not read as having searched for hours.
    expect(zones).toMatch(/spent >= 1 && spent <= 3 \* \(row\.minutes \|\| 60\) \? spent : null/);
  });

  test('a debrief goes on the person\'s own last search of that area, and is one of three answers', () => {
    expect(zones).toMatch(/export const COVERED = \['ALL', 'MOST', 'PART'\];/);
    expect(zones).toMatch(/if \(!COVERED\.includes\(covered\)\) return \{ error: 'BAD_DEBRIEF' \};/);
    expect(zones).toMatch(/where: \{ caseId, zoneId: String\(zoneId\), searcherId: searcher\.id, outcome: 'SEARCHED', endedAt: \{ gte: new Date\(now - DEBRIEF_MS\) \} \}/);
    expect(route).toMatch(/if \(area && action === 'debrief'\) \{\s+const said = await debriefZone\(\{ caseId: pet\.id, zoneId: id, searcher, covered: body\.covered/);
  });
});

describe('where it is shown', () => {
  const helper = read('app/mission-control/steps/Helper.js');
  const command = read('app/mission-control/desktop/Command.js');
  const map = read('app/mission-control/components/SearchMap.js');
  const groundCard = read('app/mission-control/desktop/Ground.js');
  const dial = read('app/mission-control/desktop/Dial.js');

  test('the helper is asked once, on the card that says thank you: how much, then what they could not get to', () => {
    expect(helper).toMatch(/\{onDebrief && <Debrief key=\{done\} onSend=\{onDebrief\} \/>\}/);
    expect(helper).toMatch(/How much of it did you cover\?/);
    expect(helper).toMatch(/\['ALL', 'All of it'\],\s+\['MOST', 'Most of it'\],\s+\['PART', 'Part of it'\],/);
    expect(helper).toMatch(/Anything you could not get to\?/);
    // It is not a second yellow button, and nothing waits on it.
    const block = helper.slice(helper.indexOf('function Debrief('), helper.indexOf('/**', helper.indexOf('function Debrief(')));
    expect(block).not.toMatch(/<Primary/);
  });

  test('the map draws the green from what the search is still worth, and says the age under the name', () => {
    expect(command).toMatch(/strength: i\.searchCount > 0 \? searchStrength\(i, clock\) : 0,/);
    expect(command).toMatch(/age: i\.searchCount > 0 && i\.status !== 'IN_PROGRESS' && i\.searchedAt \? agoShort\(i\.searchedAt, clock\) : null,/);
    expect(map).toMatch(/text: area\.age, tone: 'bare', theme, side: 'under'/);
    // Drawn again as time passes, every ten minutes and not with every tick.
    expect(command).toMatch(/const clock = Math\.floor\(now \/ 600000\) \* 600000;/);
    expect(command).toMatch(/\[ground, items, next, clock\]/);
  });

  test('the key says the green fades over a day', () => {
    expect(command).toMatch(/\['fresh', look\.walked, 'Searched just now'\],\s+\['faded', look\.walked, 'Fades over a day'\],/);
    expect(command).not.toMatch(/'Searched once'|'Twice or more'/);
  });

  test('the dial, the list and the card use the same strength, and the card lists the searches', () => {
    expect(dial).toMatch(/0\.1 \+ 0\.82 \* searchStrength\(area, now\)/);
    expect(dial).toMatch(/last searched over a day ago/);
    expect(groundCard).toMatch(/0\.12 \+ 0\.8 \* searchStrength\(area, now\)/);
    expect(groundCard).toMatch(/const log = searchLog\(area, \{ timeZone: picture\.timeZone, now \}\);/);
    expect(groundCard).toMatch(/A search counts for less as the hours pass, and for nothing after a day\./);
  });

  test('the estimate is never shown as a number or a percentage', () => {
    for (const source of [command, map, groundCard, dial, helper]) {
      expect(source).not.toMatch(/searchStrength\([^)]*\)\s*\*\s*100|% (covered|searched|likely)|probability/i);
    }
  });
});
