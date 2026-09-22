/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import SignInCard from '@/app/geo/components/SignInCard';

jest.mock('@/app/geo/lib/profile', () => ({ ensureProfile: jest.fn(), profileHeaders: () => ({}) }));
const response = (data, ok = true) => ({ ok, json: async () => data });
afterEach(() => jest.restoreAllMocks());

test('does not flash a signup form while an existing session is loading', async () => {
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
  expect(screen.getByRole('button', { name: 'Sign out' }).className).toContain('min-h-[44px]');
});

test('a failed session check is retryable and is not presented as signed out', async () => {
  let checks = 0;
  global.fetch = jest.fn(async (url) => url.endsWith('/options') ? response({ phone: false })
    : ++checks === 1 ? response({}, false) : response({ signedIn: false }));
  render(<SignInCard requireName />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not check your account');
  expect(screen.queryByLabelText('Email')).toBeNull();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Check again' })));
  expect(await screen.findByLabelText('Email')).toBeInTheDocument();
  expect(screen.getByLabelText(/Player name/)).toBeInTheDocument();
});
