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
  const needs = read('app/mission-control/desktop/Needs.js');
  const lines = [SARAMA.hello('Max', '5 days'), SARAMA.hello('Max', ''), SARAMA.back('Max'), SARAMA.join(), SARAMA.training(), SARAMA.asked('Avery'), SARAMA.asked(null), SARAMA.done(3), SARAMA.next('Flyers'), SARAMA.nobodyOut('Max'), SARAMA.nextArea('the west side')];

  test('she speaks as herself, short and plain', () => {
    expect(SARAMA.hello('Max', '5 days')).toBe("I'm Sarama, and I'm looking for Max, missing 5 days. Here is how to help right now.");
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
      expect(line).not.toMatch(/\u2014/);
    }
  });

  test('what she says is useful: to someone new, their own home first and what to do on seeing the pet', () => {
    // Founder, 2026-11-13: "make the text actually useful and teaches people where to look".
    expect(helper).toMatch(/\[trail\?\.mine\?\.paws > 0 \? SARAMA\.back\(name\) : SARAMA\.hello\(name, missingFor\(picture\.lastSeen\?\.at, now\)\), brief\.own, brief\.never\]/);
    const { briefFor } = require('@/app/lib/brief');
    expect(briefFor({ way: 'own', pet: { petName: 'Max', petSpecies: 'DOG' } })).toEqual(['First look around your own home: your yard, under your porch or deck, your shed and your garage.']);
    expect(briefFor({ way: 'own', pet: { petName: 'Milo', petSpecies: 'CAT' } })[0]).toMatch(/under your porch or deck, in your shed and garage, and in thick bushes\. A scared cat hides within a few houses\./);
  });

  test('on a helper\'s area she says where to look and whether to call, in the brief\'s own words', () => {
    expect(helper).toMatch(/const advice = sighting \? \[brief\.never, brief\.look, brief\.call\] : \[brief\.look, brief\.call\];/);
    expect(helper).toMatch(/<Sarama className="mt-3" pose=\{sighting \? 'point' : 'sniff'\} say=\{advice\} \/>/);
    // Nothing of her own about how to search: that is the brief's.
    for (const line of lines) expect(line).not.toMatch(/look low|under |call out|chase|sidewalk|garage|shed/i);
  });

  test('she cheers only an area searched, and its paw prints land with her', () => {
    expect(helper).toMatch(/pose=\{done && ground \? 'cheer' : ask \? 'point' : 'sit'\}/);
    expect(helper).toMatch(/\{done && ground && <Paws count=\{PAWS\.SEARCH\} className="mb-2" \/>\}/);
    expect(helper).toMatch(/\{told && <Paws count=\{PAWS\.DEBRIEF\} className="mt-1\.5" \/>\}/);
  });

  test('she does not greet a desk: whoever runs the search is not asked to come and look', () => {
    expect(helper).toMatch(/\{!desk && \(\s+<Sarama/);
  });

  test('the person running the search is never told nothing is waiting: she says the next thing to do', () => {
    // Founder, 2026-11-13: "Nothing is waiting for you ... What does this mean? so confusing. My pet is waiting
    // for me, he is still lost".
    expect(needs).not.toMatch(/Nothing is waiting/);
    expect(read('app/mission-control/lib/ground.js')).not.toMatch(/Nothing is waiting/);
    expect(needs).toMatch(/\{guide\.about\}/);
    expect(needs).toMatch(/\{guide\.next\.lead\}/);
    expect(needs).toMatch(/Set it up in Tasks/);
    const command = read('app/mission-control/desktop/Command.js');
    expect(command).toMatch(/const next = \(plan\.kinds \|\| \[\]\)\.find\(\(k\) => k\.kind !== 'OTHER' && !have\.has\(k\.kind\)\) \|\| null;/);
    expect(command).toMatch(/onTasks=\{guide\?\.next \? \(\) => setTab\('tasks'\) : null\}/);
    expect(SARAMA.nobodyOut('Max')).toBe('Nobody is searching right now. Text the link to neighbors so more people are watching for Max.');
    expect(SARAMA.nextArea('the west side')).toBe('When a neighbor offers to search, they are sent to the west side first.');
  });

  test('to the person running the search she is words, not a picture, and nothing cheers', () => {
    // Founder, 2026-11-13, on the desk: "feels cartoonish ... does not scream professional S&R interface mission
    // control". Her next step from the plan is still said there. Her picture is for the people helping.
    expect(needs).not.toMatch(/SaramaPose|<Sarama /);
    expect(needs).toMatch(/guide\.next\.lead/);
    expect(needs).not.toMatch(/pose=|<Paws/);
    expect(read('app/globals.css')).toMatch(/\.sarama-still \.sarama-tail \{ animation: none; \}/);
  });

  test('she and the paw prints hold still for anyone who asked their device for less motion', () => {
    const css = read('app/globals.css');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s+\.sarama-tail, \.sarama-tail\.sarama-quick, \.sarama-eyes, \.sarama-glow, \.sarama-nod, \.sarama-hop, \.mc-sarama-says, \.mc-paw \{ animation: none; \}/);
  });
});

/**
 * Founder, 2026-11-13: "You can redraw her using claude design and make
 * dynamic images". She is drawn in poses, one for each thing she does.
 */
describe('Sarama, drawn', () => {
  const { SARAMA_POSES, SARAMA_BOX, saramaArt } = require('@/app/mission-control/lib/saramaArt');
  const helper = read('app/mission-control/steps/Helper.js');
  const component = read('app/mission-control/components/Sarama.js');
  const css = read('app/globals.css');

  test('five poses, each a drawing of its own in the same box', () => {
    expect(SARAMA_POSES).toEqual(['sit', 'ask', 'point', 'sniff', 'cheer']);
    expect(SARAMA_BOX).toBe('0 0 160 160');
    const drawn = SARAMA_POSES.map((pose) => saramaArt(pose));
    expect(new Set(drawn).size).toBe(SARAMA_POSES.length);
    // A pose nobody drew is her sitting, never an empty box.
    expect(saramaArt('flying')).toBe(saramaArt('sit'));
  });

  test('every pose has the vest, the headlamp and its light, so she is the same dog in each', () => {
    for (const pose of SARAMA_POSES) {
      const art = saramaArt(pose);
      expect(art).toContain('fill="#f1ee1f"'); // the vest and the strap of the lamp
      expect(art).toContain('fill="#4b5563"'); // the lamp
      expect(art).toContain('class="sarama-glow"');
      expect(art).toContain('class="sarama-tail');
    }
  });

  test('the drawing is fixed markup: no script, no link out, nothing of a person\'s', () => {
    for (const pose of SARAMA_POSES) {
      expect(saramaArt(pose)).not.toMatch(/<script|<a |href=|http|on[a-z]+=|<image|<foreignObject/i);
    }
    expect(component).toMatch(/dangerouslySetInnerHTML=\{\{ __html: saramaArt\(pose\) \}\}/);
  });

  test('each moving part named in the drawing is moved by the stylesheet', () => {
    const classes = new Set(SARAMA_POSES.flatMap((pose) => [...saramaArt(pose).matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(' '))));
    expect([...classes].sort()).toEqual(['sarama-eyes', 'sarama-glow', 'sarama-hop', 'sarama-nod', 'sarama-quick', 'sarama-tail']);
    for (const name of ['sarama-tail', 'sarama-eyes', 'sarama-glow', 'sarama-nod', 'sarama-hop']) {
      expect(css).toMatch(new RegExp(`\\.${name} \\{ animation: `));
    }
  });

  test('the pose says what she is doing: asking, sending, searching, cheering', () => {
    expect(helper).toMatch(/pose=\{done && ground \? 'cheer' : ask \? 'point' : 'sit'\}/);
    expect(helper).toMatch(/<Sarama className="mb-3" pose="ask" say=\{SARAMA\.join\(\)\} \/>/);
    expect(helper).toMatch(/pose=\{sighting \? 'point' : 'sniff'\}/);
  });
});
