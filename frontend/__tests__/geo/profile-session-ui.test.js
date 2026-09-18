/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProfileClient from '@/app/geo/components/ProfileClient';
import { ensureProfile } from '@/app/geo/lib/profile';
jest.mock('@/app/geo/lib/profile', () => ({ ensureProfile: jest.fn(), profileHeaders: () => ({}) }));
jest.mock('@/app/geo/lib/useRoom', () => ({ saveName: jest.fn(), loadName: () => 'Old device nickname' }));
jest.mock('@/app/geo/components/SignInCard', () => function SignIn() { return null; });
jest.mock('@/app/geo/components/AccountRole', () => function Role() { return null; });
const profile = (name, points) => ({ name, points, ratings: {}, recent: [], badges: [], ledger: [] });
const response = (points) => ({ ok: true, json: async () => ({ shop: { points, items: [] } }) });

const PROMPT = /Your account has no name yet/;

test('loading an existing profile never renames it from a stale device nickname', async () => {
  ensureProfile.mockResolvedValue(profile('Account name', 36));
  global.fetch = jest.fn(async () => response(36));
  render(<ProfileClient />);
  await screen.findByRole('heading', { name: /^Account name/ });
  expect(ensureProfile).toHaveBeenCalledWith('');
  expect(ensureProfile).not.toHaveBeenCalledWith('Old device nickname');
});

test('session changes clear the old shop balance before displaying a new profile', async () => {
  let finishGuest;
  ensureProfile.mockResolvedValueOnce(profile('Signed-in player', 36))
    .mockImplementationOnce(() => new Promise((resolve) => { finishGuest = resolve; }));
  global.fetch = jest.fn().mockResolvedValueOnce(response(36)).mockResolvedValueOnce(response(0));
  render(<ProfileClient />);
  await screen.findByRole('heading', { name: /^Signed-in player/ });
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  await screen.findByText('36', { exact: true });
  await act(async () => { window.dispatchEvent(new Event('geo:session-changed')); });
  expect(screen.queryByText('36', { exact: true })).toBeNull();
  await act(async () => { finishGuest(profile('Guest player', 0)); });
  await screen.findByRole('heading', { name: /^Guest player/ });
  expect(screen.queryByText('36', { exact: true })).toBeNull();
});

beforeEach(() => { jest.clearAllMocks(); });

/**
 * A profile created without a name is *stored* called "Player", so a
 * signed-in account that never chose one renders a page titled with a
 * name nobody picked - the exact screen the founder rejected on a guest
 * ("why does it pretend I have an account named player"). The prompt is
 * the only thing on that page that says so, and the name field it opens
 * is in a tab nobody has a reason to visit.
 */
test('a signed-in account still called Player is told, and the prompt opens the name field', async () => {
  ensureProfile.mockResolvedValue({ ...profile('Player', 0), signedIn: true });
  global.fetch = jest.fn(async () => response(0));
  render(<ProfileClient />);
  await screen.findByRole('heading', { name: /^Player/ });

  expect(screen.getByText(PROMPT)).toBeInTheDocument();
  const fix = screen.getByRole('button', { name: 'Choose your name' });
  expect(fix.className).toContain('min-h-[44px]');

  // It has to land on the field, not merely somewhere in Settings.
  await act(async () => fireEvent.click(fix));
  expect(screen.getByLabelText('Your name')).toBeInTheDocument();
});

test('a signed-in account with a chosen name is not nagged', async () => {
  ensureProfile.mockResolvedValue({ ...profile('Kevin', 0), signedIn: true });
  global.fetch = jest.fn(async () => response(0));
  render(<ProfileClient />);
  await screen.findByRole('heading', { name: /^Kevin/ });
  expect(screen.queryByText(PROMPT)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Choose your name' })).toBeNull();
});

test('a guest is offered an account rather than a rename', async () => {
  ensureProfile.mockResolvedValue({ ...profile('Player', 0), signedIn: false });
  global.fetch = jest.fn(async () => response(0));
  render(<ProfileClient />);
  await screen.findByRole('heading', { name: /^Player/ });
  expect(screen.queryByText(PROMPT)).toBeNull();
  expect(screen.getByText('Guest, this browser')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Save your player' })).toBeInTheDocument();
});

test('cosmetic purchase and equip use named touch-sized controls and update the balance', async () => {
  ensureProfile.mockResolvedValue(profile('Shop player', 200));
  const item = { id: 'pin-ring', name: 'Ring', kind: 'pin', price: 100, affordable: true, owned: false, usable: false };
  let shop = { points: 200, items: [item], equipped: {} };
  global.fetch = jest.fn(async (url, options) => {
    if (options?.method === 'POST') {
      const { action, itemId } = JSON.parse(options.body);
      expect(itemId).toBe('pin-ring');
      shop = action === 'buy' ? { ...shop, points: 100, items: [{ ...item, owned: true, usable: true }] }
        : { ...shop, equipped: { pin: 'pin-ring' } };
    }
    return { ok: true, json: async () => ({ shop }) };
  });
  render(<ProfileClient />);
  await screen.findByRole('heading', { name: /^Shop player/ });
  fireEvent.click(screen.getByRole('tab', { name: 'Shop', exact: true }));
  const buy = await screen.findByRole('button', { name: 'Buy Ring for 100 points' });
  expect(buy.className).toContain('min-h-[44px]');
  await act(async () => fireEvent.click(buy));
  const wear = screen.getByRole('button', { name: 'Wear Ring' });
  expect(wear.className).toContain('min-h-[44px]');
  expect(screen.getByText('100', { exact: true })).toBeInTheDocument();
  await act(async () => fireEvent.click(wear));
  expect(screen.getByText('Wearing')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Wear Ring' })).toBeNull();
});
