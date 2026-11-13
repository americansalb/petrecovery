/**
 * Sarama guides the search, and helping is a game.
 *
 * Founder, 2026-11-13: "one of the things we are missing is our mascot
 * Sarama, beautifully guiding everyone. This has to feel like a fun game
 * and drive engagement, not feel like a chore."
 */
import fs from 'fs';
import path from 'path';
import { PAWS, RANKS, pawsFor, rankOf, nextRank, trailOf, freshAreas, FRESH_HOURS } from '@/app/lib/trail';
import { SARAMA } from '@/app/mission-control/lib/sarama';

const read = (file) => fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');
const NOW = new Date('2026-11-13T18:00:00Z').getTime();
const ago = (hours) => new Date(NOW - hours * 3600000).toISOString();

describe('paw prints', () => {
  test('an area searched leaves three, and the debrief on it one more', () => {
    expect(PAWS).toEqual({ SEARCH: 3, DEBRIEF: 1 });
    expect(pawsFor({ searches: 2, debriefs: 1 })).toBe(7);
    expect(pawsFor()).toBe(0);
  });

  test('they are counted from the record of searches, the team\'s and the reader\'s own', () => {
    const finished = [
      { outcome: 'SEARCHED', searcherId: 'dana', covered: 'ALL' },
      { outcome: 'SEARCHED', searcherId: 'dana', covered: null },
      { outcome: 'SEARCHED', searcherId: 'sam', covered: 'PART' },
      { outcome: 'MARKED', searcherId: 'm:owner', covered: null },
    ];
    expect(trailOf(finished, 'dana')).toEqual({ paws: 11, helpers: 2, mine: { searches: 2, debriefs: 1, paws: 7, rank: 'Scout' } });
    expect(trailOf(finished, null)).toEqual({ paws: 11, helpers: 2, mine: null });
    expect(trailOf([], 'dana')).toEqual({ paws: 0, helpers: 0, mine: { searches: 0, debriefs: 0, paws: 0, rank: '' } });
  });

  test('saying "all of it" earns no more than saying "part of it": a reward for the answer would buy the answer', () => {
    const one = (covered) => trailOf([{ outcome: 'SEARCHED', searcherId: 'dana', covered }], 'dana').mine.paws;
    expect(one('ALL')).toBe(one('PART'));
    expect(one('ALL')).toBe(one('MOST'));
  });

  test('ground put down from the desk leaves none', () => {
    expect(trailOf([{ outcome: 'MARKED', searcherId: 'm:owner', covered: null }], 'm:owner').paws).toBe(0);
  });

  test('ranks: Scout from the first print, Tracker at 8, Trail lead at 20', () => {
    expect(RANKS.map((r) => r.name)).toEqual(['Trail lead', 'Tracker', 'Scout']);
    expect(rankOf(0)).toBe('');
    expect(rankOf(1)).toBe('Scout');
    expect(rankOf(8)).toBe('Tracker');
    expect(rankOf(20)).toBe('Trail lead');
    expect(nextRank(3)).toEqual({ name: 'Tracker', need: 5 });
    expect(nextRank(0)).toEqual({ name: 'Scout', need: 1 });
    expect(nextRank(25)).toBeNull();
  });
});

describe('the goal everyone shares', () => {
  test('how many of the search\'s own areas were searched in the last twelve hours or are being searched now', () => {
    const areas = [
      { ring: 0, status: 'SEARCHED', searchedAt: ago(2) },
      { ring: 1, status: 'SEARCHED', searchedAt: ago(13) },
      { ring: 1, status: 'IN_PROGRESS', searchedAt: null },
      { ring: 1, status: 'UNSEARCHED', searchedAt: null },
      { ring: 3, status: 'SEARCHED', searchedAt: ago(1) },
    ];
    expect(FRESH_HOURS).toBe(12);
    expect(freshAreas(areas, NOW)).toEqual({ fresh: 2, total: 4 });
    expect(freshAreas([], NOW)).toEqual({ fresh: 0, total: 0 });
  });
});

describe('what the game never pays for', () => {
  const trail = read('app/lib/trail.js');
  const component = read('app/mission-control/components/Sarama.js');
  const helper = read('app/mission-control/steps/Helper.js');

  test('nothing for speed, for how many in an hour, or for going near the animal', () => {
    const code = trail.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(code).not.toMatch(/minutes|startedAt|endedAt|perHour|speed|fast|sighting|approach|caught/i);
  });

  test('no board of who has the most: the count everyone sees is the team\'s', () => {
    for (const source of [trail.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''), component, helper]) {
      expect(source).not.toMatch(/leaderboard|ranking of|top helpers|#1\b|first place|beat /i);
    }
    expect(read('app/lib/searchZones.js')).toMatch(/trail: trailOf\(finished \|\| \[\], viewer\),/);
    // What is sent is counts. Nobody's name or id goes with them.
    expect(read('app/api/mission/[missionId]/board/route.js')).toMatch(/trail: read\.trail \|\| null,/);
  });

  test('the shared goal is a count anyone can check, never a percentage or a likelihood', () => {
    expect(component).toMatch(/Keep the map green: \{goal\.fresh\} of \{goal\.total\} areas searched in the last \{FRESH_HOURS\} hours\./);
    expect(component).not.toMatch(/%|percent|probab|likely/i);
  });
});

describe('Sarama', () => {
  const helper = read('app/mission-control/steps/Helper.js');
  const lines = [SARAMA.hello('Max', 0), SARAMA.hello('Max', 1), SARAMA.hello('Max', 3), SARAMA.back('Max'), SARAMA.join(), SARAMA.training(), SARAMA.area(), SARAMA.asked('Avery'), SARAMA.asked(null), SARAMA.done(3), SARAMA.debriefed(), SARAMA.owner('Max')];

  test('she speaks as herself, short and plain', () => {
    expect(SARAMA.hello('Max', 0)).toBe("I'm Sarama. Max is still missing, and nobody is out looking right now. Come and look with me.");
    expect(SARAMA.hello('Max', 1)).toBe("I'm Sarama. 1 person is out looking for Max right now. Come and look with us.");
    expect(SARAMA.hello('Max', 3)).toMatch(/3 people are out looking for Max right now/);
    expect(SARAMA.done(3)).toBe('Well done. That is 3 paw prints on this search.');
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(130);
      expect(line.split(/[.!?]\s/).length).toBeLessThanOrEqual(3);
    }
  });

  test('no puns, no baby talk, no promise that a search will work, and nobody is hurried or told to stop', () => {
    for (const line of lines) {
      expect(line).not.toMatch(/paw-?some|pawsome|fur-?ever|woof|bark|sniff|tail-?wag|good boy|good girl|hooman|\bpup\b|!/i);
      expect(line).not.toMatch(/will find|we'll find|guarantee|sure to|quick|hurry|fast|race|stop\b/i);
      expect(line).not.toMatch(/—/);
    }
  });

  test('she is on every card a helper sees, and cheers only an area searched', () => {
    expect(helper.match(/<Sarama\b/g)).toHaveLength(4); // Main, Join, Training, Area
    expect(helper).toMatch(/mood=\{done && ground \? 'cheer' : 'guide'\}/);
    expect(helper).toMatch(/\{done && ground && <Paws count=\{PAWS\.SEARCH\} className="mb-2" \/>\}/);
    expect(helper).toMatch(/\{told && <Paws count=\{PAWS\.DEBRIEF\} className="mt-1\.5" \/>\}/);
  });

  test('to the person running the search she is calm: her face is there, and nothing cheers', () => {
    const needs = read('app/mission-control/desktop/Needs.js');
    expect(needs).toMatch(/<SaramaFace size=\{30\} \/>/);
    expect(needs).not.toMatch(/mood=|<Paws/);
  });

  test('she and the paw prints hold still for anyone who asked their device for less motion', () => {
    const css = read('app/globals.css');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s+\.mc-sarama-idle, \.mc-sarama-cheer, \.mc-sarama-says, \.mc-paw \{ animation: none; \}/);
  });

  test('how to search stays the brief\'s and the training\'s: her lines carry no technique', () => {
    for (const line of lines) expect(line).not.toMatch(/look low|under|call |chase|sidewalk|yard|garage|shed/i);
  });
});
