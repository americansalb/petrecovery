import { POST as round } from '@/app/api/geo/script/detective/round/route';
import { POST as guess } from '@/app/api/geo/script/detective/guess/route';

const previous = process.env.GEO_TOKEN_SECRET;
beforeAll(() => { process.env.GEO_TOKEN_SECRET = 'detective-api-qa-test-secret'; });
afterAll(() => { if (previous === undefined) delete process.env.GEO_TOKEN_SECRET; else process.env.GEO_TOKEN_SECRET = previous; });
const request = (body) => ({ json: async () => body });

test('round and guess routes expose the new unranked experience with no-store responses', async () => {
  const response = await round(request({ config: { rounds: 3, seed: 'detective-api' } }));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const body = await response.json();
  expect(body.round.choices).toHaveLength(4);
  expect(body.round.answer).toBeUndefined();
  const scored = await guess(request({ token: body.round.token, guess: { choice: body.round.choices[0].id } }));
  expect(scored.status).toBe(200);
  expect(scored.headers.get('cache-control')).toBe('no-store');
  expect((await scored.json()).result).toMatchObject({ kind: 'script-detective', mapPoints: 0 });
});

test('malformed bodies and invalid guess tokens are rejected without internal details', async () => {
  const broken = { json: async () => { throw new Error('bad json'); } };
  expect((await round(broken)).status).toBe(400);
  expect((await guess(broken)).status).toBe(400);
  expect((await guess(request({}))).status).toBe(400);
  const invalid = await guess(request({ token: 'not-a-token' }));
  expect(invalid.status).toBe(400);
  expect((await invalid.json()).code).toBe('invalid');
});

test('round creation fails closed when the signing secret is absent', async () => {
  const geo = process.env.GEO_TOKEN_SECRET;
  const next = process.env.NEXTAUTH_SECRET;
  delete process.env.GEO_TOKEN_SECRET; delete process.env.NEXTAUTH_SECRET;
  try { expect((await round(request({}))).status).toBe(503); }
  finally {
    process.env.GEO_TOKEN_SECRET = geo;
    if (next !== undefined) process.env.NEXTAUTH_SECRET = next;
  }
});
