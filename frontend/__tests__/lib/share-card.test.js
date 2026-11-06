/**
 * A mission's link preview uses the kit's link-preview image once the cascade
 * has drawn it (app/lib/shareMetadata.js), and the pet's photo until then.
 */

jest.mock('@/app/lib/config', () => ({ __esModule: true, getBaseUrl: () => 'https://www.reunitepets.org' }));

import { missionShareMetadata, missionShareSelect, missionShareCard } from '@/app/lib/shareMetadata';

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
