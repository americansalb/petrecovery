/** @jest-environment jsdom */
/**
 * How a screen tells the search it has shown something (useSearch `saw`).
 *
 * The desk reads "seen" from this and from nothing else, and the person
 * holding the phone is out on a street. So three things have to hold:
 * each thing shown is sent once when it is heard; one that was not heard
 * (no signal) is sent again the next time the card says it; and an ask
 * taken back and made again for the same street is a new ask, sent again.
 *
 * The real hook, with the network as a stand-in that keeps what was sent.
 */
import { renderHook, act, waitFor } from '@testing-library/react';

jest.mock('next-auth/react', () => ({ useSession: () => ({ status: 'unauthenticated' }) }));

import useSearch from '@/app/mission-control/hooks/useSearch';

const street = (id, over = {}) => ({ id, name: `Elm ${id}`, status: 'UNSEARCHED', mine: false, ...over });
const net = { board: null, patch: 'ok', sent: [] };

const answer = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
  net.board = { unit: 'street', streets: [street('a', { askedOfMe: true, askedSeen: false })] };
  net.patch = 'ok';
  net.sent = [];
  window.localStorage.clear();
  global.fetch = jest.fn(async (url, init = {}) => {
    if (init.method === 'PATCH') {
      if (net.patch === 'no signal') throw new Error('offline');
      net.sent.push(JSON.parse(init.body));
      if (net.patch === 'refused') return answer({ error: 'no' }, 500);
      return answer({ seen: { words: 1, ask: 1 } });
    }
    if (String(url).endsWith('/picture')) {
      return answer({ id: 'case-1', caseNumber: 'AUS-1', open: true, sightings: [], asked: 'a', words: [], viewer: { kind: 'volunteer', isOwner: false, leads: false } });
    }
    if (String(url).endsWith('/board')) return answer(net.board);
    return answer({}, 404);
  });
});
afterEach(() => {
  delete global.fetch;
});

async function open() {
  const hook = renderHook(() => useSearch('AUS-1'));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  await waitFor(() => expect(hook.result.current.items).toHaveLength(1));
  return hook;
}

test('a word is said once: the card saying it again sends nothing more', async () => {
  const hook = await open();
  await act(async () => expect(await hook.result.current.saw({ words: ['m1'] })).toEqual({ ok: true }));
  await act(async () => expect(await hook.result.current.saw({ words: ['m1'] })).toEqual({ ok: true }));
  await act(async () => hook.result.current.saw({ words: ['m1', 'm2'] }));
  expect(net.sent).toEqual([{ words: ['m1'] }, { words: ['m2'] }]);
  hook.unmount();
});

test('a word that was not heard is sent again the next time the card says it', async () => {
  const hook = await open();
  net.patch = 'no signal';
  let first;
  await act(async () => {
    first = await hook.result.current.saw({ words: ['m1'] });
  });
  expect(first.error).toMatch(/No connection/);
  expect(net.sent).toEqual([]);
  // The server answered, but with a failure: not heard either.
  net.patch = 'refused';
  await act(async () => hook.result.current.saw({ words: ['m1'] }));
  net.patch = 'ok';
  await act(async () => hook.result.current.saw({ words: ['m1'] }));
  await act(async () => hook.result.current.saw({ words: ['m1'] }));
  // Tried while refused, then heard, then silent.
  expect(net.sent).toEqual([{ words: ['m1'] }, { words: ['m1'] }]);
  hook.unmount();
});

test('the ask is said once while the board is catching up', async () => {
  const hook = await open();
  await act(async () => hook.result.current.saw({ ask: true }));
  await act(async () => hook.result.current.saw({ ask: true }));
  expect(net.sent).toEqual([{ ask: true }]);
  // The board now says the search heard it. The card has nothing to say, and if it did nothing would be sent.
  net.board = { unit: 'street', streets: [street('a', { askedOfMe: true, askedSeen: true })] };
  await act(async () => hook.result.current.reload());
  await act(async () => hook.result.current.saw({ ask: true }));
  expect(net.sent).toEqual([{ ask: true }]);
  hook.unmount();
});

test('taken back and asked again for the same street: it is a new ask, and is said again', async () => {
  const hook = await open();
  await act(async () => hook.result.current.saw({ ask: true }));
  net.board = { unit: 'street', streets: [street('a', { askedOfMe: true, askedSeen: true })] };
  await act(async () => hook.result.current.reload());
  // The same street, asked again between two reads: the board says it has not been shown.
  net.board = { unit: 'street', streets: [street('a', { askedOfMe: true, askedSeen: false })] };
  await act(async () => hook.result.current.reload());
  await act(async () => hook.result.current.saw({ ask: true }));
  expect(net.sent).toEqual([{ ask: true }, { ask: true }]);
  hook.unmount();
});

test('nothing to say sends nothing', async () => {
  const hook = await open();
  await act(async () => expect(await hook.result.current.saw()).toEqual({ ok: true }));
  await act(async () => expect(await hook.result.current.saw({ words: [null, ''] })).toEqual({ ok: true }));
  expect(net.sent).toEqual([]);
  hook.unmount();
});
