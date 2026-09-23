/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import SignInCard from '@/app/geo/components/SignInCard';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/app/geo/lib/profile', () => ({ ensureProfile: jest.fn(), profileHeaders: () => ({}) }));
const response = (data, ok = true) => ({ ok, json: async () => data });
// The readable companion of a session cookie (lib/session.js): this
// browser has a session to check.
const withSession = () => { document.cookie = 'geo_signed_in=1; path=/'; };
afterEach(() => {
  jest.restoreAllMocks();
  document.cookie = 'geo_signed_in=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

test('does not flash a signup form while an existing session is loading', async () => {
  withSession();
  let resolveAccount;
  global.fetch = jest.fn((url) => url.endsWith('/options')
    ? Promise.resolve(response({ phone: false }))
    : new Promise((resolve) => { resolveAccount = resolve; }));
  render(<SignInCard requireName />);
  expect(screen.getByRole('status').textContent).toContain('Checking your account');
  expect(screen.queryByLabelText('Email')).toBeNull();
  await act(async () => resolveAccount(response({ signedIn: true, email: 'test@example.test' })));
  expect(screen.getByText(/Signed in as/).textContent).toContain('test@example.test');
  expect(screen.queryByLabelText('Email')).toBeNull();
  // Thumb-sized: .ui-btn is 44px tall (theme.css).
  expect(screen.getByRole('button', { name: 'Sign out' }).className).toContain('ui-btn');
});

test('a failed session check is retryable and is not presented as signed out', async () => {
  withSession();
  let checks = 0;
  global.fetch = jest.fn(async (url) => url.endsWith('/options') ? response({ phone: false })
    : ++checks === 1 ? response({}, false) : response({ signedIn: false }));
  render(<SignInCard requireName />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not check your account');
  expect(screen.queryByLabelText('Email')).toBeNull();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Check again' })));
  expect(await screen.findByLabelText('Email')).toBeInTheDocument();
  // The first screen is the address alone (returning-player.test.js).
  expect(screen.queryByLabelText(/Player name/)).toBeNull();
});

/**
 * A browser with no session cookie has nobody to check. On the live site
 * "Checking your account" stood where the email field should be for two
 * to four seconds on a phone; the field is there at once now, and stays
 * whatever the check says, unless it finds a session after all.
 */
test('a browser with no session shows the email field at once', async () => {
  let resolveAccount;
  global.fetch = jest.fn((url) => url.endsWith('/options')
    ? Promise.resolve(response({ phone: false }))
    : new Promise((resolve) => { resolveAccount = resolve; }));
  render(<SignInCard requireName />);
  expect(await screen.findByLabelText('Email')).toBeInTheDocument();
  await act(async () => resolveAccount(response({ signedIn: false })));
  expect(screen.getByLabelText('Email')).toBeInTheDocument();
});

test('a failed check does not take the form away from a signed-out browser', async () => {
  global.fetch = jest.fn(async (url) => url.endsWith('/options') ? response({ phone: false }) : response({}, false));
  render(<SignInCard requireName />);
  expect(await screen.findByLabelText('Email')).toBeInTheDocument();
  await act(async () => {});
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByLabelText('Email')).toBeInTheDocument();
});

test('a session the cookie did not know about still wins', async () => {
  global.fetch = jest.fn(async (url) => url.endsWith('/options') ? response({ phone: false }) : response({ signedIn: true, email: 'old@example.test' }));
  render(<SignInCard requireName />);
  expect(await screen.findByText(/Signed in as/)).toHaveTextContent('old@example.test');
  expect(screen.queryByLabelText('Email')).toBeNull();
});
