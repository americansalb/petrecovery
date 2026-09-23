/** @jest-environment jsdom */

/**
 * Coming back is not signing up again, and signing in is the normal
 * process: an address, then the code from the email.
 *
 * The server was always right about returning players: the same
 * address returns the same account and its own profile. The interface
 * was what was wrong, twice over. First a returning player was blocked
 * until they invented a name, which was then thrown away (founder,
 * 2026-09-22: "each time I try to sign in it signs me up as a new
 * user"). Then the form carried a "Player name (new players)" field
 * above the email, under two headings, and sent a link that a phone's
 * mail app opened in the wrong browser (2026-09-23: "Very unclear. Why
 * not just have normal sign in process?").
 *
 * So the first screen asks for an address and nothing else, the second
 * for the code, and a name is asked for only once somebody is in, only
 * if they have none, and they can skip it.
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SignInCard from '@/app/geo/components/SignInCard';

const router = { push: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('@/app/geo/lib/profile', () => ({ ensureProfile: jest.fn(async () => ({})), profileHeaders: () => ({}) }));
jest.mock('@/app/geo/lib/useRoom', () => ({ saveName: jest.fn() }));
const { ensureProfile } = require('@/app/geo/lib/profile');

const response = (data, ok = true) => ({ ok, json: async () => data });

function server({ profileName = 'Player', codeOk = true } = {}) {
  ensureProfile.mockImplementation(async (name) => ({ name: name || profileName }));
  global.fetch = jest.fn(async (url) => {
    if (String(url).endsWith('/options')) return response({ phone: false });
    if (String(url).includes('/auth/request')) return response({ ok: true, message: 'Check your email.' });
    if (String(url).includes('/auth/code')) return codeOk ? response({ ok: true, signedIn: true, email: 'kevin@example.test' }) : response({ error: 'That code is not right.' }, false);
    if (String(url).includes('/auth/me')) return response({ signedIn: false });
    return response({});
  });
}

const posted = (path) => global.fetch.mock.calls.filter(([u]) => String(u).includes(path));

async function toCodeStep() {
  fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'kevin@example.test' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  return screen.findByLabelText('Code');
}

beforeEach(() => jest.clearAllMocks());

test('the first screen asks for an address and nothing else', async () => {
  server();
  render(<SignInCard requireName />);
  expect(await screen.findByLabelText('Email')).toBeRequired();
  // The name field that sat above it, for "new players", is gone.
  expect(screen.queryByLabelText(/Player name/)).toBeNull();
  expect(screen.getAllByRole('textbox')).toHaveLength(1);
});

test('a returning player needs only an address to get a code', async () => {
  server();
  render(<SignInCard requireName />);
  await toCodeStep();
  expect(posted('/auth/request')).toHaveLength(1);
  expect(JSON.parse(posted('/auth/request')[0][1].body).email).toBe('kevin@example.test');
  expect(screen.getByText('kevin@example.test')).toBeInTheDocument();
});

test('six digits are the whole answer: nobody has to find a button', async () => {
  server({ profileName: 'Kevin' });
  const onAuthenticated = jest.fn();
  render(<SignInCard requireName onAuthenticated={onAuthenticated} />);
  const code = await toCodeStep();
  await act(async () => fireEvent.change(code, { target: { value: '123456' } }));
  expect(posted('/auth/code')).toHaveLength(1);
  expect(JSON.parse(posted('/auth/code')[0][1].body)).toEqual({ email: 'kevin@example.test', code: '123456' });
  await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
});

test('a player who already has a name is not asked for one', async () => {
  server({ profileName: 'Kevin' });
  const onAuthenticated = jest.fn();
  render(<SignInCard requireName onAuthenticated={onAuthenticated} />);
  const code = await toCodeStep();
  await act(async () => fireEvent.change(code, { target: { value: '123456' } }));
  await waitFor(() => expect(onAuthenticated).toHaveBeenCalled());
  expect(screen.queryByLabelText('Player name')).toBeNull();
});

test('a new player is asked for a name once they are in, and it goes on their profile', async () => {
  server({ profileName: 'Player' });
  const onAuthenticated = jest.fn();
  render(<SignInCard requireName onAuthenticated={onAuthenticated} />);
  const code = await toCodeStep();
  await act(async () => fireEvent.change(code, { target: { value: '123456' } }));
  const name = await screen.findByLabelText('Player name');
  // Not finished yet: the name is one more screen, not a hidden gate.
  expect(onAuthenticated).not.toHaveBeenCalled();
  fireEvent.change(name, { target: { value: 'Kevin' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save and continue' })));
  expect(ensureProfile).toHaveBeenCalledWith('Kevin');
  expect(onAuthenticated).toHaveBeenCalledTimes(1);
});

test('and can skip it', async () => {
  server({ profileName: 'Player' });
  const onAuthenticated = jest.fn();
  render(<SignInCard requireName onAuthenticated={onAuthenticated} />);
  const code = await toCodeStep();
  await act(async () => fireEvent.change(code, { target: { value: '123456' } }));
  await screen.findByLabelText('Player name');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  expect(onAuthenticated).toHaveBeenCalledTimes(1);
  expect(ensureProfile).not.toHaveBeenCalledWith(expect.stringMatching(/\S/));
});

test('a wrong code says so and lets them type it again', async () => {
  server({ codeOk: false });
  render(<SignInCard requireName />);
  const code = await toCodeStep();
  await act(async () => fireEvent.change(code, { target: { value: '000000' } }));
  expect(await screen.findByRole('alert')).toHaveTextContent('That code is not right.');
  expect(screen.getByLabelText('Code')).toHaveValue('');
});

test('the first screen says what happens, for somebody new and somebody coming back', async () => {
  server();
  render(<SignInCard requireName />);
  await screen.findByLabelText('Email');
  expect(screen.getByText(/6-digit code/)).toBeInTheDocument();
  expect(screen.queryByText(/Make this your player/)).toBeNull();
});
