/**
 * /api/admin/groups/sweep: admin-only manual group discovery for a city.
 */

jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/cascade/actions/shareTargets', () => ({
  __esModule: true,
  sweepArea: jest.fn(),
}));

import { POST } from '@/app/api/admin/groups/sweep/route';
import { getServerSession } from 'next-auth';
import { sweepArea } from '@/app/lib/cascade/actions/shareTargets';

function post(body) {
  return POST(
    new Request('http://localhost/api/admin/groups/sweep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('rejects non-admins', async () => {
  getServerSession.mockResolvedValue({ user: { role: 'USER' } });
  const res = await post({ city: 'Elgin', state: 'IL' });
  expect(res.status).toBe(403);
  expect(sweepArea).not.toHaveBeenCalled();
});

test('rejects a missing city', async () => {
  getServerSession.mockResolvedValue({ user: { role: 'ADMIN' } });
  const res = await post({ state: 'IL' });
  expect(res.status).toBe(400);
  expect(sweepArea).not.toHaveBeenCalled();
});

test('surfaces a not-configured sweep as a 400 with the reason', async () => {
  getServerSession.mockResolvedValue({ user: { role: 'ADMIN' } });
  sweepArea.mockResolvedValue({ ok: false, reason: 'BRAVE_SEARCH_API_KEY is not configured', groups: [], candidates: 0 });
  const res = await post({ city: 'Elgin', state: 'IL' });
  expect(res.status).toBe(400);
  const data = await res.json();
  expect(data.error).toMatch(/BRAVE_SEARCH_API_KEY/);
});

test('runs the sweep and returns the saved groups', async () => {
  getServerSession.mockResolvedValue({ user: { role: 'ADMIN' } });
  sweepArea.mockResolvedValue({
    ok: true,
    candidates: 7,
    groups: [{ name: 'Lost Pets of Elgin', url: 'https://www.facebook.com/groups/lostpetselgin' }],
  });

  const res = await post({ city: '  Elgin ', state: 'IL' });
  expect(res.status).toBe(200);
  expect(sweepArea).toHaveBeenCalledWith('Elgin', 'IL');
  const data = await res.json();
  expect(data.groups).toHaveLength(1);
  expect(data.candidates).toBe(7);
});
