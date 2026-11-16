/**
 * A mission's link preview uses the kit's link-preview image once the cascade
 * has drawn it (app/lib/shareMetadata.js), and the pet's photo until then.
 */

jest.mock('@/app/lib/config', () => ({ __esModule: true, getBaseUrl: () => 'https://www.reunitepets.org' }));

import { missionShareMetadata, missionShareSelect, missionShareCard, missionPlace } from '@/app/lib/shareMetadata';

const MISSION = {
  caseNumber: 'AUS-2026-HF27J2',
  reportType: 'LOST',
  petName: 'Max',
  petSpecies: 'DOG',
  petBreed: 'Golden Retriever',
  petPhotoUrl: 'https://petrescue.b-cdn.net/pets/max.jpg',
  petDescription: 'Red collar, a tag with our number.',
  lastSeenAddress: '12 Oak St, Austin, TX',
  lastSeenAt: new Date(Date.now() - 86400000),
  status: 'ACTIVE',
};
const CARD = 'https://petrescue.b-cdn.net/cases/abc/social_og.jpg?v=f8ad58aa';

describe('the mission share card image', () => {
  test('the select brings only the ready link-preview image, one at most', () => {
    expect(missionShareSelect.activation).toEqual({
      select: { assets: { where: { kind: 'SOCIAL_OG', status: 'ready' }, select: { url: true }, take: 1 } },
    });
  });

  test('with the kit drawn, the card is the og:image and the twitter image', () => {
    const m = missionShareMetadata({ ...MISSION, activation: { assets: [{ url: CARD }] } }, { canonicalPath: '/cases/AUS-2026-HF27J2', index: true });
    expect(missionShareCard({ activation: { assets: [{ url: CARD }] } })).toBe(CARD);
    expect(m.openGraph.images[0]).toMatchObject({ url: CARD, width: 1200, height: 630 });
    expect(m.openGraph.images[0].alt).toContain('Max');
    expect(m.twitter.images).toEqual([CARD]);
    expect(m.twitter.card).toBe('summary_large_image');
  });

  test('until then, the pet\'s photo; and an asset without a url does not count', () => {
    for (const activation of [undefined, null, { assets: [] }, { assets: [{ url: null }] }]) {
      const m = missionShareMetadata({ ...MISSION, activation }, { canonicalPath: '/cases/AUS-2026-HF27J2' });
      expect(m.openGraph.images[0].url).toBe(MISSION.petPhotoUrl);
      expect(m.openGraph.images[0].alt).toBe('Max - Lost dog');
    }
    expect(missionShareCard({})).toBeNull();
  });

  test('the words are the same with or without the card', () => {
    const a = missionShareMetadata({ ...MISSION, activation: { assets: [{ url: CARD }] } }, {});
    const b = missionShareMetadata(MISSION, {});
    expect(a.title).toBe(b.title);
    expect(a.openGraph.title).toBe(b.openGraph.title);
    expect(a.description).toBe(b.description);
  });
});

describe('the place and the kind of animal in the words', () => {
  // What "Use my location" stores: the geocoder's whole address, ending in the postcode and the country.
  const FROM_MY_LOCATION = 'Congress Avenue, Downtown, Austin, Travis County, Texas, 78701, United States';
  const MEXICO = 'Calle de Durango 200, Roma Norte, Cuauhtémoc, Ciudad de México, 06700, México';
  const all = (m) =>
    [m.title, m.description, m.openGraph.title, m.openGraph.description, m.twitter.title, m.twitter.description, m.openGraph.images[0].alt].join(' | ');

  test('a report made with "Use my location" names the town, never the postcode', () => {
    const mia = { ...MISSION, petName: 'Mia', petSpecies: 'CAT', petBreed: 'Unknown', lastSeenAddress: FROM_MY_LOCATION };
    const lost = missionShareMetadata(mia, {});
    expect(lost.openGraph.title).toBe('LOST: Mia - Austin, TX');
    const join = missionShareMetadata(mia, { variant: 'join' });
    expect(join.title).toBe('Join the search for Mia in Austin, TX | ReunitePets');
    for (const m of [lost, join]) expect(all(m)).not.toMatch(/78701/);
  });

  test('outside the US the card names the city the address ends in, and no postcode or street is a place', () => {
    const m = missionShareMetadata({ ...MISSION, petBreed: 'Unknown', lastSeenAddress: MEXICO }, {});
    expect(m.title).toBe('Help Find Max - Lost dog in Ciudad de México');
    expect(all(m)).not.toMatch(/06700|Durango/);
    // Apple's shape for the same city, with no country: the city, not the street before it.
    const typed = 'Jardín Centenario, Calle Felipe Carrillo Puerto, Mexico City, Mexico City';
    expect(missionShareMetadata({ ...MISSION, petBreed: 'Unknown', lastSeenAddress: typed }, {}).title).toBe('Help Find Max - Lost dog in Mexico City');
    expect(missionPlace('Unter den Linden 1, Mitte, Berlin, 10117, Deutschland')).toBe('Berlin');
  });

  test('a US address without a state still gives the town, not the postcode or the county', () => {
    expect(missionPlace('Congress Avenue, Downtown, Austin, Travis County, 78701, United States')).toBe('Austin');
    expect(missionPlace('12 Oak St, Austin')).toBe('Austin');
    expect(missionPlace('E 6th St, Austin, TX 78701')).toBe('Austin, TX');
  });

  test('a breed stored as Unknown is never shown, in any variant', () => {
    for (const reportType of ['LOST', 'FOUND']) {
      for (const variant of [undefined, 'join']) {
        const m = missionShareMetadata({ ...MISSION, reportType, petSpecies: 'CAT', petBreed: 'Unknown', petDescription: null }, { variant });
        expect(all(m)).not.toMatch(/unknown/i);
      }
    }
    const cat = missionShareMetadata({ ...MISSION, petSpecies: 'CAT', petBreed: 'Unknown', petDescription: null }, {});
    expect(cat.description).toMatch(/^Max is a lost cat last seen/);
  });

  test('a breed the report names is kept', () => {
    expect(missionShareMetadata(MISSION, {}).title).toBe('Help Find Max - Lost Golden Retriever dog in Austin, TX');
  });

  test('an address that names no town gives a card with no place, not a guess', () => {
    for (const lastSeenAddress of ['30.2672, -97.7431', '78701', '', null]) {
      const m = missionShareMetadata({ ...MISSION, lastSeenAddress }, {});
      expect(m.openGraph.title).toBe('LOST: Max');
      expect(m.title).toBe('Help Find Max - Lost Golden Retriever dog');
      expect(all(m)).not.toMatch(/Unknown Location| in \.|\d{5}/);
    }
  });

  test('a found report with no date, no place and no name still reads as a sentence', () => {
    const m = missionShareMetadata(
      { ...MISSION, reportType: 'FOUND', petName: 'Unknown', petBreed: 'Unknown', petDescription: '', lastSeenAt: null, lastSeenAddress: null },
      {}
    );
    expect(m.description).toBe('A dog was found. Is this your pet?');
    expect(m.openGraph.title).toBe('FOUND: dog');
    expect(m.openGraph.images[0].alt).toBe('Found dog');
  });
});
