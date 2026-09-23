/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import GameError from '@/app/geo/error';
let log;
beforeEach(() => { log = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => log.mockRestore());

test('ordinary game errors retry in place without pet-site copy or unverified monitoring promises', () => {
  const reset = jest.fn();
  const error = new Error('private diagnostic details');
  render(<GameError error={error} reset={reset} />);
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(reset).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link', { name: 'Back to the start' }).getAttribute('href')).toBe('/geo');
  expect(document.body.textContent).not.toMatch(/private diagnostic|petrecovery|team.*notified|data.*safe/i);
  expect(log).toHaveBeenCalledWith('[geo] screen failed', 'Error');
});

test.each(['Loading chunk 123 failed.', 'Loading CSS chunk 123 failed.', 'Failed to fetch dynamically imported module'])('a missing asset recovers with a full same-page reload: %s', (message) => {
  render(<GameError error={new Error(message)} reset={jest.fn()} />);
  expect(screen.getByRole('link', { name: 'Reload game' }).getAttribute('href')).toBe('');
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  expect(screen.getByText(/match keeps running/)).toBeTruthy();
});
