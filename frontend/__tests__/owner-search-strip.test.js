/** @jest-environment jsdom */
/**
 * The strip under the top bar that takes a guest owner back to their own
 * search (app/components/OwnerSearchStrip.js), rendered, for what a rule
 * read from its source cannot see: who sees it, when it asks, and that a
 * browser without a key gets nothing at all.
 *
 * Founder, 2026-11-17, approving it: "show a slim '<Pet>'s search' banner
 * under the top bar on every page, only in the browser that reported it.
 * ... The bar itself stays identical; a strip below it links to their
 * search." The bar's side of that is held in __tests__/global-chrome.test.js.
 */
import React from 'react';
import { render, act } from '@testing-library/react';

const state = { pathname: '/', status: 'unauthenticated' };
jest.mock('next/navigation', () => ({ __esModule: true, usePathname: () => state.pathname }));
jest.mock('next-auth/react', () => ({ __esModule: true, useSession: () => ({ status: state.status, data: null }) }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href, ...rest }) => <a href={href} {...rest}>{children}</a> }));

import OwnerSearchStrip from '@/app/components/OwnerSearchStrip';

const DAY = 24 * 60 * 60 * 1000;
const RUFUS = { caseNumber: 'AUS-2026-0007', petName: 'Rufus', url: '/mission-control?mission=AUS-2026-0007', hasEmail: true, lostAt: new Date(Date.now() - 3 * DAY - 60000).toISOString() };

/** The server's answer for this browser, as fetch would give it. */
function answers(...bodies) {
  global.fetch = jest.fn();
  for (const body of bodies) global.fetch.mockResolvedValueOnce({ ok: true, json: async () => body });
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ open: null }) });
}

/** Render, then move to `paths` one after another, letting each answer arrive. */
async function visit(first, ...paths) {
  state.pathname = first;
  let view;
  await act(async () => {
    view = render(<OwnerSearchStrip />);
  });
  for (const p of paths) {
    state.pathname = p;
    await act(async () => {
      view.rerender(<OwnerSearchStrip />);
    });
  }
  return view;
}

beforeEach(() => {
  state.pathname = '/';
  state.status = 'unauthenticated';
});

test("the browser that reported a lost pet sees the pet's search, with how long it has been missing, linking to it", async () => {
  answers({ open: RUFUS });
  const { container } = await visit('/');
  const link = container.querySelector('a');
  expect(link.getAttribute('href')).toBe('/mission-control?mission=AUS-2026-0007');
  expect(link.textContent).toContain("Rufus's search");
  expect(link.textContent).toContain('Missing 3 days');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith('/api/owner/open-search', { cache: 'no-store' });
});

test('a browser without a key gets nothing: no strip and no space held for one', async () => {
  answers({ open: null });
  const { container } = await visit('/');
  expect(container.innerHTML).toBe('');
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('nothing is drawn before the answer comes, so a page without a strip never moves', async () => {
  let reply;
  global.fetch = jest.fn(() => new Promise((resolve) => (reply = resolve)));
  state.pathname = '/';
  let view;
  await act(async () => {
    view = render(<OwnerSearchStrip />);
  });
  expect(view.container.innerHTML).toBe('');
  await act(async () => reply({ ok: true, json: async () => ({ open: RUFUS }) }));
  expect(view.container.textContent).toContain("Rufus's search");
});

test('someone signed in is not asked and sees nothing: their account menu and dashboard reach the search', async () => {
  answers({ open: RUFUS });
  state.status = 'authenticated';
  const { container } = await visit('/', '/lost-and-found');
  expect(container.innerHTML).toBe('');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('while the session is not known yet nothing is asked', async () => {
  answers({ open: RUFUS });
  state.status = 'loading';
  const { container } = await visit('/');
  expect(container.innerHTML).toBe('');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('an answer that arrives after signing in is dropped', async () => {
  let reply;
  global.fetch = jest.fn(() => new Promise((resolve) => (reply = resolve)));
  state.pathname = '/';
  let view;
  await act(async () => {
    view = render(<OwnerSearchStrip />);
  });
  state.status = 'authenticated';
  await act(async () => view.rerender(<OwnerSearchStrip />));
  await act(async () => reply({ ok: true, json: async () => ({ open: RUFUS }) }));
  // Signed out again: asked afresh, and until that answer comes nothing of the old one is shown.
  state.status = 'unauthenticated';
  global.fetch = jest.fn(() => new Promise(() => {}));
  await act(async () => view.rerender(<OwnerSearchStrip />));
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(view.container.innerHTML).toBe('');
});

test('moving between ordinary pages asks once, and the strip stays on every one of them', async () => {
  answers({ open: RUFUS });
  const { container } = await visit('/', '/lost-and-found', '/cases/AUS-2026-0007', '/shelters');
  expect(container.textContent).toContain("Rufus's search");
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('not drawn inside a takeover, which has its own way back; asked again on the way out of the search screen', async () => {
  // The owner marks the pet home on the search screen: on coming back, the strip goes.
  answers({ open: RUFUS }, { open: null });
  const view = await visit('/');
  expect(view.container.textContent).toContain("Rufus's search");
  state.pathname = '/mission-control';
  await act(async () => view.rerender(<OwnerSearchStrip />));
  expect(view.container.innerHTML).toBe('');
  for (const p of ['/my-shelter', '/rasuwa', '/geo/play']) {
    state.pathname = p;
    await act(async () => view.rerender(<OwnerSearchStrip />));
    expect(view.container.innerHTML).toBe('');
  }
  expect(global.fetch).toHaveBeenCalledTimes(1);
  state.pathname = '/cases/AUS-2026-0007';
  await act(async () => view.rerender(<OwnerSearchStrip />));
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(view.container.innerHTML).toBe('');
});

test('a page load on the report form asks nothing until the visitor leaves it, then shows the search just made', async () => {
  answers({ open: RUFUS });
  const view = await visit('/report/new');
  expect(global.fetch).not.toHaveBeenCalled();
  state.pathname = '/';
  await act(async () => view.rerender(<OwnerSearchStrip />));
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector('a').getAttribute('href')).toBe('/mission-control?mission=AUS-2026-0007');
});

test('a failed or refused answer draws nothing', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ open: RUFUS }) });
  expect((await visit('/')).container.innerHTML).toBe('');
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  expect((await visit('/')).container.innerHTML).toBe('');
});
