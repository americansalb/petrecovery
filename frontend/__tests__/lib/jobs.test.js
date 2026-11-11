/**
 * One job at a time (app/lib/jobs.js): how and when someone can help
 * becomes one job from what the search really needs, with a brief.
 */

jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('@/app/lib/forceNeeds', () => ({ __esModule: true, listNeeds: jest.fn() }));
jest.mock('@/app/lib/petRoom', () => ({ __esModule: true, nextParty: jest.fn() }));
jest.mock('@/app/lib/searchBoard', () => ({ __esModule: true, openBlocks: jest.fn() }));

import { rankJobs, briefFor, pickJob, WAYS, WHENS } from '@/app/lib/jobs';
import { listNeeds } from '@/app/lib/forceNeeds';
import { nextParty } from '@/app/lib/petRoom';
import { openBlocks } from '@/app/lib/searchBoard';

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
    expect(jobs[0].why).toMatch(/warmest/);
    const hour = rankJobs({ blocks: [block('A1', 3), block('C4', 9), block('D4', 8)], way: 'foot', when: 'now60' });
    expect(hour[0].title).toBe('Walk C4, D4 and A1');
    expect(hour[0].cellIds).toEqual(['cell-C4', 'cell-D4', 'cell-A1']);
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

  test('the search party says streets are handed out', () => {
    const jobs = rankJobs({ party: { id: 'post-1', goingCount: 4 }, way: 'foot', when: 'party' });
    expect(jobs[0].why).toBe('4 going so far. Streets are handed out when it meets.');
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

describe('briefFor', () => {
  test('a dog on foot: walk, look low, call once a minute, never chase', () => {
    const lines = briefFor({ way: 'foot', pet: { petName: 'Max', petSpecies: 'DOG' } });
    expect(lines).toHaveLength(4);
    expect(lines[2]).toMatch(/Call "Max" once a minute/);
    expect(lines[3]).toMatch(/don't chase/);
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
