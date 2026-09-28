/**
 * The automatic posts in a force's Discussion (app/lib/forceFeed.js): what
 * each kind says, that a place never carries a house number or the
 * geocoder's whole address, how older automatic posts are told apart from
 * members' own, and one post per force the pet is with.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { caseAssignment: { findMany: jest.fn() }, squadPost: { createMany: jest.fn() } },
}));

import prisma from '@/app/lib/prisma';
import { feedPost, kindOf, petLine, forcesOf, postToForces } from '@/app/lib/forceFeed';

const MAX = { petName: 'Max', petSpecies: 'DOG', petBreed: 'Golden Retriever', petColor: 'Golden', reportType: 'LOST', lastSeenAddress: '2100 Barton Springs Rd, Austin, TX 78704' };
const ROCKET = { petName: 'Rocket', petSpecies: 'DOG', petBreed: null, petColor: 'Brown', reportType: 'LOST', lastSeenAddress: 'Andrew Zilker Road, Austin, Travis County, Texas, 78703, United States' };
const FOUND = { petName: 'Unknown', petSpecies: 'CAT', petColor: 'Black', reportType: 'FOUND', lastSeenAddress: 'Riverview Park, Clinton, IA' };

beforeEach(() => jest.clearAllMocks());

test('what the pet looks like, in a few words', () => {
  expect(petLine(MAX)).toBe('Golden Retriever');
  expect(petLine(ROCKET)).toBe('Dog, brown');
  expect(petLine({ petSpecies: 'CAT', petBreed: 'Tabby', petColor: 'Grey' })).toBe('Tabby, grey');
});

test('a lost pet: the name, what it looks like, the place without its house number', () => {
  expect(feedPost('LOST', MAX)).toEqual({ title: 'Max is missing', content: 'Golden Retriever. Last seen near Barton Springs Rd.' });
  expect(feedPost('LOST', ROCKET, { note: "Just outside this force's area." })).toEqual({
    title: 'Rocket is missing',
    content: "Dog, brown. Last seen near Andrew Zilker Road. Just outside this force's area.",
  });
  // Never the geocoder's whole address.
  expect(feedPost('LOST', ROCKET).content).not.toMatch(/Travis County|78703|United States/);
});

test('a found pet asks whether it is one of ours; a sighting; a homecoming', () => {
  expect(feedPost('FOUND', FOUND)).toEqual({
    title: 'A cat was found near Riverview Park',
    content: 'Someone found a cat near Riverview Park and reported it. Is it one of the pets this force is looking for?',
  });
  expect(feedPost('SIGHTING', MAX, { place: 'Barton Springs Pool', note: 'Heading toward the trailhead.' })).toEqual({
    title: 'Max was seen near Barton Springs Pool',
    content: 'Heading toward the trailhead.',
  });
  expect(feedPost('SIGHTING', MAX, { place: '' })).toEqual({ title: 'Max was seen', content: '' });
  expect(feedPost('HOME', MAX)).toEqual({ title: 'Max is home', content: 'Max is back with the family.' });
  expect(() => feedPost('PARTY', MAX)).toThrow(/kind/);
});

test("older automatic posts are told by their wording; a member's post has no kind", () => {
  expect(kindOf({ kind: 'HOME', title: 'Max is home' })).toBe('HOME');
  expect(kindOf({ title: 'Rocket is missing', content: 'Rocket, a brown dog, was reported lost near Andrew Zilker Road. Case #AUS-2026-HXEN47.' })).toBe('LOST');
  expect(kindOf({ title: 'Max is missing nearby', content: 'Max was reported lost just outside this area. Case #AUS-2026-0001.' })).toBe('LOST');
  expect(kindOf({ title: 'A dog was found near Zilker Park', content: 'Someone found a dog near Zilker Park.' })).toBe('FOUND');
  expect(kindOf({ title: 'Greenbelt search recap', content: 'We covered the east loop.' })).toBeNull();
  expect(kindOf({ title: null, content: 'Max is missing from my yard, please help. Case #123' })).toBeNull();
});

test('one post per force the pet is with, and a failure never throws', async () => {
  prisma.caseAssignment.findMany.mockResolvedValue([{ rescueSquadId: 'f-a' }, { rescueSquadId: 'f-b' }, { rescueSquadId: 'f-a' }]);
  expect(await forcesOf('case-max')).toEqual(['f-a', 'f-b']);
  expect(prisma.caseAssignment.findMany.mock.calls[0][0].where).toMatchObject({ missionId: 'case-max', status: { in: ['ACCEPTED', 'ACTIVE', 'STANDBY'] } });

  prisma.squadPost.createMany.mockResolvedValue({ count: 2 });
  const post = { authorId: 'u-mike', caseId: 'case-max', kind: 'SIGHTING', title: 'Max was seen near the pool', content: '' };
  expect(await postToForces({ forceIds: ['f-a', 'f-b'], ...post })).toBe(2);
  expect(prisma.squadPost.createMany.mock.calls[0][0].data[1]).toEqual({ rescueSquadId: 'f-b', ...post });
  expect(await postToForces({ forceIds: [], ...post })).toBe(0);
  prisma.squadPost.createMany.mockRejectedValue(new Error('db down'));
  expect(await postToForces({ forceIds: ['f-a'], ...post })).toBe(0);
});
