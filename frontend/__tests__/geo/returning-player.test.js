/** @jest-environment jsdom */

/**
 * Coming back is not signing up again.
 *
 * The server was always right about this: the same address returns the
 * same account, and completeSignIn gives it back the account's own
 * profile, so the name, rating and badges survive a new browser. Driven
 * end to end against a real database, visit two came back as the same
 * profile id with the same name.
 *
 * The interface was the part that was wrong. A returning player was
 * BLOCKED until they invented a player name - "Choose a player name
 * first." - and then the name was thrown away, because following the
 * link binds the account and the account's profile wins. Being made to
 * name yourself and then not being remembered is what "each time I try
 * to sign in it signs me up as a new user" feels like (founder,
 * 2026-09-22), and the header saying "Create account" over a card
 * headed "Make this your player" told them the same thing twice.
 *
 * So: an address is the whole of signing in. The name is optional and
 * only lands on a player who does not have one; anybody who ends up
 * without one is asked on the profile page, where it is theirs to keep.
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SignInCard from '@/app/geo/components/SignInCard';

jest.mock('@/app/geo/lib/profile', () => ({ ensureProfile: jest.fn(async () => ({})), profileHeaders: () => ({}) }));
const { ensureProfile } = require('@/app/geo/lib/profile');

const response = (data, ok = true) => ({ ok, json: async () => data });

function signedOut() {
  global.fetch = jest.fn(async (url, options) => {
    if (String(url).endsWith('/options')) return response({ phone: false });
    if (String(url).includes('/auth/request')) return response({ ok: true, message: 'Check your email.' });
    if (String(url).includes('/auth/me')) return response({ signedIn: false });
    return response({});
  });
}

afterEach(() => jest.restoreAllMocks());

test('a returning player needs only an address, not a new name', async () => {
  signedOut();
  render(<SignInCard requireName />);
  const email = await screen.findByLabelText('Email');

  // Leave the name empty, exactly as somebody who already has one would.
  fireEvent.change(email, { target: { value: 'kevin@example.test' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Continue/ })));

  // The link is requested. It used to refuse with "Choose a player name first."
  await waitFor(() => {
    const asked = global.fetch.mock.calls.some(([u]) => String(u).includes('/auth/request'));
    expect(asked).toBe(true);
  });
  expect(screen.queryByText(/Choose a player name first/)).toBeNull();
});

test('the name field is there for new players but never required', async () => {
  signedOut();
  render(<SignInCard requireName />);
  const name = await screen.findByLabelText(/Player name/);
  expect(name).not.toBeRequired();
  expect(screen.getByLabelText('Email')).toBeRequired();
});

test('a name typed by a new player is still carried to the account', async () => {
  signedOut();
  render(<SignInCard requireName />);
  fireEvent.change(await screen.findByLabelText(/Player name/), { target: { value: 'Kevin' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'kevin@example.test' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Continue/ })));
  await waitFor(() => expect(ensureProfile).toHaveBeenCalledWith('Kevin'));
});

test('the card speaks to somebody coming back, not only to somebody new', async () => {
  signedOut();
  render(<SignInCard requireName />);
  await screen.findByLabelText('Email');
  // "Make this your player" was true for half the people who read it.
  expect(screen.queryByText(/Make this your player/)).toBeNull();
  expect(screen.getByText(/brings your player, rating and badges back/i)).toBeInTheDocument();
});
