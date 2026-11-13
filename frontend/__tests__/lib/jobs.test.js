/**
 * One job at a time (app/lib/jobs.js): how and when someone can help
 * becomes one job from what the search really needs, with a brief.
 */

jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('@/app/lib/forceNeeds', () => ({ __esModule: true, listNeeds: jest.fn() }));
jest.mock('@/app/lib/petRoom', () => ({ __esModule: true, nextParty: jest.fn() }));
jest.mock('@/app/lib/searchZones', () => ({ __esModule: true, openAreas: jest.fn() }));

import { rankJobs, briefFor, pickJob, WAYS, WHENS } from '@/app/lib/jobs';
import { listNeeds } from '@/app/lib/forceNeeds';
import { nextParty } from '@/app/lib/petRoom';
import { openAreas as openBlocks } from '@/app/lib/searchZones';

const block = (label, priority, over = {}) => ({
  id: `cell-${label}`,
  label,
  priority,
  status: 'UNSEARCHED',
  centerLatitude: 30.26,
  centerLongitude: -97.75,
  ...over,
});
const need = (id, kind, over = {}) => ({
  id,
  kind,
  title: `${kind} need`,
  taken: 0,
  peopleNeeded: 1,
  mine: null,
  byOwner: false,
  lat: null,
  lng: null,
  ...over,
});

describe('rankJobs', () => {
  test('on foot, now: the hottest unwalked block, as many as fit the time', () => {
    const jobs = rankJobs({ blocks: [block('A1', 3), block('C4', 9), block('D4', 8)], way: 'foot', when: 'now30' });
    expect(jobs[0].kind).toBe('block');
    expect(jobs[0].title).toBe('Walk C4');
    expect(jobs[0].why).toBe('Close to where the pet was lost or seen. Nobody has walked it.');
    const hour = rankJobs({ blocks: [block('A1', 3), block('C4', 9), block('D4', 8)], way: 'foot', when: 'now60' });
    expect(hour[0].title).toBe('Walk C4, D4 and A1');
    expect(hour[0].cellIds).toEqual(['cell-C4', 'cell-D4', 'cell-A1']);
  });

  test('the reason given for a street is the reason: asked for first by the owner, or walked and down for another look', () => {
    // The desk sets both (app/lib/searchBoard.js). Neither is "near the trail", and a street put up for another
    // look has been walked, so it never reads "nobody has walked it".
    const first = rankJobs({ blocks: [block('A1', 11), block('C4', 9)], way: 'foot', when: 'now30', petName: 'Max' });
    expect(first[0].title).toBe('Walk A1');
    expect(first[0].why).toBe("Max's owner asked for it to be walked first. Nobody has walked it.");
    const again = rankJobs({ blocks: [{ ...block('B2', 9), status: 'NEEDS_REVISIT' }], way: 'foot', when: 'now30', petName: 'Max' });
    expect(again[0].why).toBe('Close to where Max was lost or seen. It has been walked and is down for another look.');
    const far = rankJobs({ blocks: [{ ...block('B2', 4), status: 'NEEDS_REVISIT' }], way: 'foot', when: 'now30', petName: 'Max' });
    expect(far[0].why).toBe('It has been walked and is down for another look.');
    const plain = rankJobs({ blocks: [block('B2', 4)], way: 'foot', when: 'now30' });
    expect(plain[0].why).toBe('Nobody has walked it.');
    for (const job of [...first, ...again, ...far, ...plain]) expect(job.why).not.toMatch(/trail|warmest|poor light/);
  });

  test('from home: needs that fit, and never a block', () => {
    const jobs = rankJobs({
      blocks: [block('C4', 9)],
      needs: [need('n-area', 'area'), need('n-shelter', 'shelter', { title: 'Check Austin Animal Center' })],
      way: 'home',
      when: 'now30',
    });
    expect(jobs.map((j) => j.kind)).toEqual(['need']);
    expect(jobs[0].title).toBe('Check Austin Animal Center');
    expect(jobs[0].minutes).toBe(10);
  });

  test('a need the owner asked for and nobody is on outranks the rest', () => {
    const jobs = rankJobs({
      needs: [need('n-1', 'area'), need('n-2', 'area', { byOwner: true }), need('n-3', 'area', { taken: 1, peopleNeeded: 2 })],
      way: 'foot',
      when: 'now30',
    });
    expect(jobs[0].id).toBe('n-2');
    expect(jobs[0].why).toMatch(/owner asked/);
  });

  test('a need you are already on, or that is full, is not offered again', () => {
    const jobs = rankJobs({
      needs: [need('mine', 'area', { mine: 'on' }), need('full', 'area', { taken: 2, peopleNeeded: 2 })],
      way: 'foot',
    });
    expect(jobs).toEqual([]);
  });

  test('the search party is the job when that is the time given', () => {
    const party = { id: 'post-1', goingCount: 4 };
    const jobs = rankJobs({ blocks: [block('C4', 9)], party, way: 'foot', when: 'party' });
    expect(jobs[0].kind).toBe('party');
    expect(jobs[0].why).toMatch(/4 going/);
    const now = rankJobs({ blocks: [block('C4', 9)], party, way: 'foot', when: 'now30' });
    expect(now[0].kind).toBe('block');
  });

  test('where the board is streets, a job is one street, by name, with its own minutes', () => {
    const st = (label, priority, minutes, over = {}) => block(label, priority, { id: `st-${priority}`, unit: 'street', minutes, ...over });
    const streets = [st('Ramsey Ave from W 40th St to W 42nd St', 6, 10), st('Sinclair Ave from W 40th St to W 44th St', 9, 20)];
    // An hour fits several squares, and still one street: one person holds one street at a time.
    const jobs = rankJobs({ blocks: streets, way: 'foot', when: 'now60' });
    expect(jobs[0]).toMatchObject({
      kind: 'block',
      unit: 'street',
      id: 'st-9',
      cellIds: ['st-9'],
      title: 'Walk Sinclair Ave from W 40th St to W 44th St',
      minutes: 20,
    });
    // By car the street keeps its capitals.
    const car = rankJobs({ blocks: streets, way: 'car', when: 'now30' });
    expect(car[0].title).toBe('Drive the edge of the area, then walk Sinclair Ave from W 40th St to W 44th St');
    // Squares are still squares.
    expect(rankJobs({ blocks: [block('C4', 9)], way: 'foot' })[0]).toMatchObject({ unit: 'block', minutes: 20 });
    expect(rankJobs({ blocks: [block('C4', 9)], way: 'car' })[0].title).toBe('Drive the edge of the area, then walk c4');
  });

  test('the search party says areas are handed out', () => {
    const jobs = rankJobs({ party: { id: 'post-1', goingCount: 4 }, way: 'foot', when: 'party' });
    expect(jobs[0].why).toBe('4 going so far. Areas to search are handed out when it meets.');
  });

  test('the nearer block wins a tie, and the job says how far', () => {
    const near = { lat: 30.26, lng: -97.75 };
    const far = block('H7', 8, { centerLatitude: 30.27, centerLongitude: -97.75 });
    const close = block('C4', 8, { centerLatitude: 30.263, centerLongitude: -97.75 });
    const jobs = rankJobs({ blocks: [far, close], way: 'foot', near });
    expect(jobs[0].labels).toEqual(['C4']);
    expect(jobs[0].why).toMatch(/m from you/);
  });
});

describe('rankJobs: ground', () => {
  // As the board gives areas to the job picker (app/lib/searchZones.js, openAreas).
  const area = (key, label, over = {}) => ({
    id: `zone-${key}`,
    unit: 'area',
    label,
    status: 'UNSEARCHED',
    priority: 6,
    centerLatitude: 30.3148,
    centerLongitude: -97.7488,
    minutes: 45,
    reach: `150 m to 400 m ${key} of where Max was lost`,
    landmarks: ['Jefferson St', 'Shoal Creek Blvd'],
    on: 0,
    coming: 0,
    searchCount: 0,
    searchedAt: null,
    askedOfMe: false,
    ...over,
  });

  test('a job is one area of ground to search: where it is, by the streets round it, and that nobody has searched it', () => {
    const jobs = rankJobs({ blocks: [area('north', 'North side'), area('middle', 'The middle', { priority: 8, minutes: 30, reach: 'Within 150 m of where Max was lost', landmarks: [] })], way: 'foot', when: 'now60', petName: 'Max' });
    expect(jobs[0]).toMatchObject({ kind: 'block', unit: 'area', id: 'zone-middle', cellIds: ['zone-middle'], labels: ['The middle'], title: 'Search the middle', minutes: 30 });
    expect(jobs[0].why).toBe('Within 150 m of where Max was lost. Nobody has searched it.');
    const west = rankJobs({ blocks: [area('west', 'West side')], way: 'foot', petName: 'Max' });
    expect(west[0].title).toBe('Search the west side');
    expect(west[0].why).toBe('150 m to 400 m west of where Max was lost, around Jefferson St and Shoal Creek Blvd. Nobody has searched it.');
    // Never "walk": ground is searched, and no job on ground names a street to walk.
    expect(JSON.stringify(west)).not.toMatch(/\bWalk\b|walked/);
  });

  test('one area whatever the time given, and by car it is driven', () => {
    const blocks = [area('west', 'West side'), area('east', 'East side')];
    expect(rankJobs({ blocks, way: 'foot', when: 'now60' }).filter((j) => j.kind === 'block')).toHaveLength(1);
    expect(rankJobs({ blocks, way: 'car' })[0].title).toBe('Drive the west side');
  });

  test('the reason given is the reason', () => {
    const why = (over) => rankJobs({ blocks: [area('west', 'West side', { reach: '', landmarks: [], ...over })], way: 'foot', petName: 'Max' })[0].why;
    expect(why({ priority: 11 })).toBe("Max's owner asked for it to be searched first. Nobody has searched it.");
    expect(why({ status: 'NEEDS_REVISIT', searchCount: 1 })).toBe('It has been searched and is down for another look.');
    expect(why({ status: 'IN_PROGRESS', on: 1 })).toBe('1 person is searching it now, and there is room for more.');
    expect(why({ status: 'IN_PROGRESS', on: 2 })).toBe('2 people are searching it now, and there is room for more.');
    // A fact about this area only. The page is handed one area, and cannot speak for the others.
    expect(why({ status: 'SEARCHED', searchCount: 1, searchedAt: '2026-11-12T10:00:00Z' })).toBe('It has been searched once.');
    expect(why({ status: 'SEARCHED', searchCount: 2, searchedAt: '2026-11-12T10:00:00Z' })).toBe('It has been searched twice.');
    expect(why({ status: 'SEARCHED', searchCount: 4, searchedAt: '2026-11-12T10:00:00Z' })).toBe('It has been searched 4 times.');
    expect(why({ status: 'SEARCHED', searchCount: 2 })).not.toMatch(/Every area|longest ago/);
    // Asked to search it by the owner: said as that, whatever else is true of it.
    expect(why({ askedOfMe: true, status: 'SEARCHED', searchCount: 1 })).toBe("Max's owner asked you to search it. It has been searched once.");
    expect(why({ askedOfMe: true, priority: 11 })).toBe("Max's owner asked you to search it. Nobody has searched it.");
  });

  test('ranked again for the nearest, the order keeps what the search screen orders by', () => {
    // "Send people here first" with someone on it, a sighting's circle on a tie, and another look with someone on it.
    const first = area('north', 'North side', { first: true, priority: 11, status: 'IN_PROGRESS', on: 1 });
    expect(rankJobs({ blocks: [area('middle', 'The middle', { priority: 8 }), first], way: 'foot' })[0].id).toBe('zone-north');
    const near = { lat: 30.3148, lng: -97.7459 };
    const seen = area('seen', 'Where Max was seen', { ring: 3, priority: 10, centerLatitude: 30.3100 });
    expect(rankJobs({ blocks: [area('south', 'South side', { priority: 10 }), seen], way: 'foot', near })[0].id).toBe('zone-seen');
    const again = area('east', 'East side', { status: 'IN_PROGRESS', on: 1, searchCount: 1, again: true });
    const job = rankJobs({ blocks: [area('middle', 'The middle', { status: 'SEARCHED', searchCount: 1, searchedAt: '2026-11-12T09:00:00Z', priority: 8 }), again], way: 'foot' })[0];
    expect(job.id).toBe('zone-east');
  });

  test('the order is the search screen\'s own: ground nobody is on first, and the nearest on a tie', () => {
    const busy = area('middle', 'The middle', { priority: 8, status: 'IN_PROGRESS', on: 1 });
    expect(rankJobs({ blocks: [busy, area('north', 'North side')], way: 'foot' })[0].id).toBe('zone-north');
    const near = { lat: 30.3148, lng: -97.7430 };
    const jobs = rankJobs({ blocks: [area('west', 'West side'), area('east', 'East side', { centerLongitude: -97.7430 })], way: 'foot', near });
    expect(jobs[0].id).toBe('zone-east');
    expect(jobs[0].why).toMatch(/Right where you are\.$/);
    // The area this person was asked to search comes before every other.
    expect(rankJobs({ blocks: [area('middle', 'The middle', { priority: 10 }), area('west', 'West side', { askedOfMe: true })], way: 'foot' })[0].id).toBe('zone-west');
  });

  test('the circle round a sighting is a job like any other, named for what it is', () => {
    const seen = area('seen', 'Where Max was seen', { priority: 10, minutes: 30, reach: 'Within 150 m of where Max was seen', landmarks: ['Ramsey Ave'] });
    const [job] = rankJobs({ blocks: [area('north', 'North side'), seen], way: 'foot', petName: 'Max' });
    expect(job.title).toBe('Search where Max was seen');
    expect(job.why).toBe('Within 150 m of where Max was seen, around Ramsey Ave. Nobody has searched it.');
  });

  test('from home there is no ground to give', () => {
    expect(rankJobs({ blocks: [area('west', 'West side')], way: 'home' })).toEqual([]);
  });
});

describe('briefFor', () => {
  test('a dog on foot: walk, look low, never chase, and a stranger does not call a dog the owner has not called friendly', () => {
    const lines = briefFor({ way: 'foot', pet: { petName: 'Max', petSpecies: 'DOG' } });
    expect(lines).toHaveLength(4);
    expect(lines[2]).toBe("Do not call out for Max. A lost dog can run from a stranger's voice. Look and listen.");
    expect(lines[3]).toMatch(/don't chase/);
  });

  test('the brief follows what the owner said the dog is like (founder, 2026-11-13: think as the search team)', () => {
    const call = (pet) => briefFor({ way: 'foot', pet: { petName: 'Max', petSpecies: 'DOG', ...pet } })[2];
    expect(call({ temperament: 'SCARED' })).toBe('Do not call Max, walk toward Max or stare. A scared dog runs from strangers. Look, listen and note where.');
    expect(call({ temperament: 'SHY' })).toMatch(/^Do not call out for Max\. A shy dog/);
    expect(call({ temperament: 'DEFENSIVE' })).toMatch(/^Do not call Max or go close\. Max may snap/);
    expect(call({ temperament: 'FRIENDLY' })).toBe('Say "Max" in a calm voice now and then, then listen. Max is friendly with people.');
    // Read from the report's own details where the row carries them, as text or as an object.
    expect(call({ details: JSON.stringify({ temperament: 'SCARED' }) })).toMatch(/^Do not call Max, walk toward Max or stare/);
    expect(call({ details: { temperament: 'FRIENDLY' } })).toMatch(/^Say "Max"/);
    expect(call({ details: 'not json' })).toMatch(/^Do not call out for Max/);
    // No helper is ever told to call a dog once a minute.
    for (const temperament of ['FRIENDLY', 'SHY', 'SCARED', 'DEFENSIVE', 'UNKNOWN', undefined]) {
      expect(briefFor({ way: 'foot', pet: { petName: 'Max', petSpecies: 'DOG', temperament } }).join(' ')).not.toMatch(/once a minute/);
      expect(briefFor({ way: 'car', pet: { petName: 'Max', petSpecies: 'DOG', temperament } }).join(' ')).not.toMatch(/once a minute/);
    }
  });

  test('a cat is hunted close and quiet', () => {
    const lines = briefFor({ way: 'foot', pet: { petName: 'Whiskers', petSpecies: 'CAT' } });
    expect(lines[1]).toMatch(/within a few houses/);
    expect(lines[2]).toMatch(/Listen more than you call/);
  });

  test('from home: what to say on the phone, with the pet described', () => {
    const lines = briefFor({ way: 'home', pet: { petName: 'Max', petSpecies: 'DOG', petColor: 'Golden', petBreed: 'Golden Retriever' } });
    expect(lines[0]).toMatch(/lost dog named Max, golden, Golden Retriever/);
  });
});

describe('pickJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    openBlocks.mockResolvedValue([block('C4', 9)]);
    listNeeds.mockResolvedValue([need('n-shelter', 'shelter')]);
    nextParty.mockResolvedValue({ id: 'post-1', goingCount: 2 });
  });

  test('a member on foot gets the block, with the needs as alternatives', async () => {
    const out = await pickJob({ pet: { id: 'case-max', petName: 'Max', petSpecies: 'DOG' }, forceId: 'force-1', userId: 'u1', member: true, way: 'foot', when: 'now30' });
    expect(out.job.kind).toBe('block');
    // The ground comes from the areas of the search, read as this person would be given them.
    expect(openBlocks).toHaveBeenCalledWith('case-max', { viewer: 'u1' });
    expect(out.way).toBe(WAYS.foot.label);
    expect(out.when).toBe(WHENS.now30.label);
    expect(out.brief).toHaveLength(4);
    expect(listNeeds).toHaveBeenCalledWith('force-1', { userId: 'u1', member: true, caseId: 'case-max' });
    expect(nextParty).not.toHaveBeenCalled();
  });

  test('someone not in the force gets blocks only', async () => {
    const out = await pickJob({ pet: { id: 'case-max', petName: 'Max' }, forceId: 'force-1', userId: 'u1', member: false, way: 'home' });
    expect(listNeeds).not.toHaveBeenCalled();
    expect(openBlocks).not.toHaveBeenCalled();
    expect(out.job).toBeNull();
  });

  test('"the next search party" reads the party for a member', async () => {
    const out = await pickJob({ pet: { id: 'case-max', petName: 'Max' }, forceId: 'force-1', userId: 'u1', member: true, way: 'foot', when: 'party' });
    expect(nextParty).toHaveBeenCalled();
    expect(out.job.kind).toBe('party');
  });
});
