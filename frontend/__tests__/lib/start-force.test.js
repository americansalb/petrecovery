/**
 * Starting a Rescue Force from the directory in one tap
 * (app/rescue-forces/startForce.js): the town travels to the Start page in
 * the URL and back, the create request's outcomes come back as one of a few
 * kinds, and each kind has one place to go.
 */

import { townParams, townFromParams, createHref, forceBody, startForce, outcomeHref } from '@/app/rescue-forces/startForce';

const WACO = { city: 'Waco', state_id: 'TX', country: 'US', zips: ['76701', '76702'], lat: 31.55, lng: -97.15 };
const MERIDA = { city: 'Mérida', state_id: 'YUC', country: 'MX', zips: [], lat: 20.97, lng: -89.62 };

afterEach(() => {
  delete global.fetch;
});

function answer(status, body) {
  global.fetch = jest.fn(async () => ({ ok: status < 400, status, json: async () => body }));
}

test('a town goes into the Start page URL and comes back the same', () => {
  expect(createHref(WACO)).toBe('/rescue-forces/create?city=Waco&state=TX&zip=76701&lat=31.55&lng=-97.15');
  expect(createHref(WACO, { start: true })).toMatch(/&start=1$/);
  expect(townFromParams(townParams(WACO))).toEqual({ ...WACO, zips: ['76701'] });
  expect(townFromParams(townParams(MERIDA))).toEqual(MERIDA);
  expect(townFromParams(createHref(MERIDA).split('?')[1]).country).toBe('MX');
  // No town: the plain Start page, and nothing to start.
  expect(createHref(null, { start: true })).toBe('/rescue-forces/create');
  expect(townFromParams('')).toBeNull();
  expect(townFromParams('city=&start=1')).toBeNull();
  // A town placed on the map only by name keeps no coordinates.
  expect(townFromParams('city=Waco&state=TX')).toEqual({ city: 'Waco', state_id: 'TX', country: 'US', zips: [] });
});

test('the request is the one the Start page always sent', () => {
  expect(forceBody(WACO)).toEqual({ city: 'Waco', state: 'TX', country: 'US', zipCode: '76701', lat: 31.55, lng: -97.15 });
  expect(forceBody(MERIDA)).toEqual({ city: 'Mérida', state: 'YUC', country: 'MX', zipCode: undefined, lat: 20.97, lng: -89.62 });
});

test('each answer from the API is one outcome', async () => {
  answer(201, { squad: { id: 'f-waco' } });
  expect(await startForce(WACO)).toEqual({ ok: true, forceId: 'f-waco' });
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({ city: 'Waco', state: 'TX' });

  answer(401, { error: 'Unauthorized' });
  expect(await startForce(WACO)).toEqual({ ok: false, kind: 'signin' });

  answer(403, { code: 'WAIVER_NOT_ACCEPTED', redirectTo: '/legal/consent' });
  expect(await startForce(WACO)).toEqual({ ok: false, kind: 'waiver' });

  answer(400, { error: 'Rescue Force already exists for this city', code: 'FORCE_EXISTS', existingForceId: 'f-old' });
  expect(await startForce(WACO)).toEqual({ ok: false, kind: 'exists', forceId: 'f-old' });

  answer(500, { error: 'Failed to create rescue force' });
  expect(await startForce(WACO)).toEqual({ ok: false, kind: 'error', message: 'Failed to create rescue force' });

  global.fetch = jest.fn(async () => {
    throw new Error('offline');
  });
  expect((await startForce(WACO)).message).toMatch(/did not go through/);
});

test('each outcome has one place to go, and sign-in and the waiver come back to start it', () => {
  expect(outcomeHref({ ok: true, forceId: 'f-waco' }, WACO)).toBe('/rescue-forces/f-waco?created=true');
  expect(outcomeHref({ ok: false, kind: 'exists', forceId: 'f-old' }, WACO)).toBe('/rescue-forces/f-old');
  const back = encodeURIComponent(createHref(WACO, { start: true }));
  expect(outcomeHref({ ok: false, kind: 'signin' }, WACO)).toBe(`/login?callbackUrl=${back}`);
  expect(outcomeHref({ ok: false, kind: 'waiver' }, WACO)).toBe(`/legal/consent?returnUrl=${back}`);
  expect(outcomeHref({ ok: false, kind: 'error', message: 'x' }, WACO)).toBeNull();
});
