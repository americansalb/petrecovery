/**
 * The flyer's layout rules (app/lib/cascade/render/flyers/layout.js) and the
 * words it is built from (normalize.js): the photo takes the room that is
 * left, the frame follows the photo's shape, the crop keeps the pet.
 */

jest.mock('@/app/lib/placeholderEmail', () => ({ __esModule: true, isPlaceholderEmail: (e) => /placeholder|noemail/.test(e || '') }));

import { planSheet, planHalf, cropRect, PAGES, SOCIAL_FRAMES, WIDE_FROM } from '@/app/lib/cascade/render/flyers/layout';
import { normalizeFlyerData } from '@/app/lib/cascade/render/flyers/normalize';

describe('planSheet', () => {
  test('a wide photo gets the full-width frame, and every block still fits on the page', () => {
    const p = planSheet(PAGES.LETTER, { aspect: 1.42 });
    expect(p.mode).toBe('wide');
    expect(p.frame.w).toBe(612 - 27 * 2);
    const used = p.band + p.topGap + p.frame.h + p.name + p.facts + p.row + p.footer + p.gap * 4 + p.tabsGap + p.tabs + p.bottom;
    expect(Math.round(used)).toBe(792);
    expect(p.frame.h).toBeGreaterThan(280);
  });

  test('a very wide photo keeps its own shape and the slack goes to the map, then the gaps', () => {
    const p = planSheet(PAGES.LETTER, { aspect: 2.4 });
    expect(p.frame.h).toBeCloseTo(p.contentW / 2.4, 0);
    expect(p.row).toBeGreaterThan(112.5);
    const used = p.band + p.topGap + p.frame.h + p.name + p.facts + p.row + p.footer + p.gap * 4 + p.tabsGap + p.tabs + p.bottom;
    expect(Math.round(used)).toBe(792);
  });

  test('a tall photo stands in a column the full height of the body, as wide as its shape allows', () => {
    const p = planSheet(PAGES.LETTER, { aspect: 0.8 });
    expect(p.mode).toBe('column');
    expect(p.frame.h).toBe(p.bodyH);
    expect(p.colW).toBe(345); // bodyH × 0.8 is past the cap
    expect(p.detailsW).toBeCloseTo(558 - 345 - 12, 5);
    expect(p.mapH).toBeGreaterThan(100);
    expect(Math.round(80 + 82 + 82 + 84 + 60 + 7.5 * 5 + 26 + p.mapH)).toBe(Math.round(p.bodyH));
    const tall = planSheet(PAGES.LETTER, { aspect: 0.5 });
    expect(tall.colW).toBeCloseTo(tall.bodyH * 0.5, 5);
    expect(planSheet(PAGES.LETTER, { aspect: 0.3 }).colW).toBe(225);
  });

  test('a square photo is a column too, at the widest the column goes', () => {
    const p = planSheet(PAGES.LETTER, { aspect: 1 });
    expect(p.mode).toBe('column');
    expect(p.colW).toBe(345);
    expect(p.frameAspect).toBeCloseTo(345 / p.bodyH, 5);
  });

  test('no photo: the wide layout, with a frame for the description', () => {
    const p = planSheet(PAGES.LETTER, null);
    expect(p.mode).toBe('none');
    expect(p.frame.h).toBeGreaterThan(280);
  });

  test('the poster scales the sheet and drops the tear tabs', () => {
    const k = 792 / 612;
    const p = planSheet(PAGES.TABLOID, { aspect: 1.5 }, { k, tabs: false });
    expect(p.tabs).toBe(0);
    expect(p.band).toBeCloseTo(105 * k, 5);
    const used = p.band + p.topGap + p.frame.h + p.name + p.facts + p.row + p.footer + p.gap * 4 + p.bottom;
    expect(Math.round(used)).toBe(1224);
  });

  test('the half sheet plans a photo column and a frame shape', () => {
    const p = planHalf(PAGES.LETTER, { aspect: 0.8 });
    expect(p.halfH).toBe(396);
    expect(p.frameAspect).toBeCloseTo(225 / p.frame.h, 5);
    expect(planHalf(PAGES.LETTER, { aspect: 1.5 }).photoW).toBe(300);
    expect(planHalf(PAGES.LETTER, null).hasPhoto).toBe(false);
  });

  test('the wide threshold is 1.2', () => {
    expect(planSheet(PAGES.LETTER, { aspect: WIDE_FROM }).mode).toBe('wide');
    expect(planSheet(PAGES.LETTER, { aspect: WIDE_FROM - 0.01 }).mode).toBe('column');
  });
});

describe('cropRect', () => {
  test('a photo that already has the shape is left alone', () => {
    expect(cropRect(1000, 500, { x: 0.5, y: 0.5 }, 2)).toBeNull();
    expect(cropRect(1000, 505, { x: 0.5, y: 0.5 }, 2)).toBeNull();
  });

  test('a wider photo is cut to the frame around the focal point, inside the photo', () => {
    expect(cropRect(1000, 500, { x: 0.9, y: 0.5 }, 1)).toEqual({ left: 500, top: 0, width: 500, height: 500 });
    expect(cropRect(1000, 500, { x: 0.3, y: 0.5 }, 1)).toEqual({ left: 50, top: 0, width: 500, height: 500 });
    expect(cropRect(1000, 500, { x: 0.0, y: 0.5 }, 1)).toEqual({ left: 0, top: 0, width: 500, height: 500 });
  });

  test('a taller photo is cut top and bottom around the focal point', () => {
    expect(cropRect(600, 1200, { x: 0.5, y: 0.2 }, 1)).toEqual({ left: 0, top: 0, width: 600, height: 600 });
    expect(cropRect(600, 1200, { x: 0.5, y: 0.5 }, 1)).toEqual({ left: 0, top: 300, width: 600, height: 600 });
    expect(cropRect(600, 1200, { x: 0.5, y: 1 }, 1)).toEqual({ left: 0, top: 600, width: 600, height: 600 });
  });

  test('bad input gives no crop', () => {
    expect(cropRect(0, 0, null, 1)).toBeNull();
    expect(cropRect(100, 100, null, 0)).toBeNull();
  });

  test('the share image frames are the sizes the boards draw', () => {
    expect(SOCIAL_FRAMES.og).toEqual({ w: 560, h: 630 });
    expect(SOCIAL_FRAMES.square.w).toBe(596);
  });
});

describe('normalizeFlyerData', () => {
  const MAX = {
    caseNumber: 'AUS-2026-0001',
    reportType: 'LOST',
    petName: 'Max',
    petSpecies: 'DOG',
    petBreed: 'Golden Retriever',
    petColor: 'Golden',
    petSize: 'LARGE',
    petDescription: 'Friendly 4-year-old golden retriever. White patch on chest.',
    escapeScenario: 'got_spooked',
    lastSeenAddress: '2100 Barton Springs Rd, Austin, TX 78704, United States',
    lastSeenAt: new Date('2026-11-02T18:30:00Z'),
    ownerName: 'Avery Jones',
    ownerPhone: '5125550100',
    ownerEmail: 'avery@example.com',
    hasReward: true,
    rewardAmount: 500,
    pet: { age: 4, microchipId: '985141', distinctiveMarks: 'white patch on the chest', collarInfo: 'blue, with a bone tag' },
  };

  test('the words on the sheet come from the report', () => {
    const d = normalizeFlyerData(MAX, {});
    expect(d.headlineBig).toBe('LOST DOG');
    expect(d.factsLine).toBe('Golden Retriever · Large · 4 years old · Microchipped');
    expect(d.lookFor).toBe('Golden coat. White patch on the chest. Blue, with a bone tag.');
    expect(d.ifYouSee).toBe("Max is probably frightened and hiding. Please don't chase or call out. Note the exact spot and call or text Avery right away.");
    expect(d.contactValue).toBe('(512) 555-0100');
    expect(d.contactSecondary).toBe('avery@example.com');
    expect(d.reward).toBe('$500');
    expect(d.lastSeenArea).toBe('2100 Barton Springs Rd, Austin');
    expect(d.lastSeenWhen).toMatch(/^Mon Nov 2, \d{1,2}:\d{2} (am|pm)$/);
    expect(d.caseUrlLabel).toBe('reunitepets.org/cases/AUS-2026-0001');
  });

  test('no phone: the QR code is the way to report', () => {
    const d = normalizeFlyerData({ ...MAX, ownerPhone: 'Not provided', ownerEmail: 'x@placeholder.test' }, {});
    expect(d.hasPhone).toBe(false);
    expect(d.contactValue).toBe('reunitepets.org/cases/AUS-2026-0001');
    expect(d.ifYouSee).toMatch(/report it with the QR code right away\.$/);
  });

  test('photos carry their shape and focal point, from either input shape', () => {
    const png = `data:image/png;base64,${Buffer.concat([
      Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
      Buffer.from([0, 0, 0x03, 0xe8, 0, 0, 0x01, 0xf4]),
      Buffer.alloc(8),
    ]).toString('base64')}`;
    const a = normalizeFlyerData(MAX, { photos: [{ dataUrl: png, w: 1000, h: 500, focal: { x: 0.7, y: 0.3 } }] });
    expect(a.photos[0]).toMatchObject({ w: 1000, h: 500, aspect: 2, focal: { x: 0.7, y: 0.3 } });
    const b = normalizeFlyerData(MAX, { photoDataUrls: [png] });
    expect(b.photos[0]).toMatchObject({ w: 1000, h: 500, aspect: 2 });
    expect(b.photos[0].focal).toEqual({ x: 0.5, y: 0.45 });
    expect(normalizeFlyerData(MAX, {}).photos).toEqual([]);
  });
});
