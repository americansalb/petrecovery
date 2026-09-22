/** @jest-environment jsdom */

/**
 * Opening your profile must not name you.
 *
 * resolveProfile stores DEFAULT_PLAYER_NAME for anybody who has not
 * chosen one, so the profile page was handed "Player" as the player's
 * name and wrote it into the browser with saveName. From then on every
 * room that browser hosted or joined arrived pre-filled with "Player",
 * as though the person had typed it - and the room's own Create and
 * Join fields read from exactly that store.
 *
 * Caught on the live site: a fresh browser that visited /geo/me once
 * and then /geo/rooms found "Player" sitting in the host name field.
 * A browser that went straight to /geo/rooms found it empty.
 *
 * This is the founder's 2026-09-17 objection - "why does it pretend I
 * have an account named player" - arriving through a different door.
 * A name goes into the browser when a person chooses one.
 */
import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import ProfileClient from '@/app/geo/components/ProfileClient';
import { DEFAULT_PLAYER_NAME } from '@/app/lib/geo/rooms';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/geo/me',
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/app/geo/lib/profile', () => ({
  ensureProfile: jest.fn(),
  profileHeaders: () => ({}),
}));
jest.mock('@/app/geo/lib/useRoom', () => ({ saveName: jest.fn() }));

const { ensureProfile } = require('@/app/geo/lib/profile');
const { saveName } = require('@/app/geo/lib/useRoom');

const open = async (profile) => {
  ensureProfile.mockResolvedValue(profile);
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ shop: { points: 0, items: [] } }) }));
  await act(async () => { render(<ProfileClient />); });
};

afterEach(() => jest.clearAllMocks());

test('the placeholder is never written into the browser', async () => {
  await open({ name: DEFAULT_PLAYER_NAME, points: 0, ratings: {}, recent: [], badges: [], usage: { rounds: 0 } });
  expect(saveName).not.toHaveBeenCalled();
});

test('a name the player chose is remembered', async () => {
  await open({ name: 'Kevin', points: 0, ratings: {}, recent: [], badges: [], usage: { rounds: 0 } });
  expect(saveName).toHaveBeenCalledWith('Kevin');
});

test('an empty name is not remembered either', async () => {
  await open({ name: '', points: 0, ratings: {}, recent: [], badges: [], usage: { rounds: 0 } });
  expect(saveName).not.toHaveBeenCalled();
});
