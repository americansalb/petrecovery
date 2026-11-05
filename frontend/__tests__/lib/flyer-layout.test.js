/**
 * The flyer's layout rules (app/lib/cascade/render/flyers/plan.js) and the
 * words it is built from (normalize.js): the photo takes the room that is
 * left, the full width of the page, and the crop keeps the pet in it.
 */

jest.mock('@/app/lib/placeholderEmail', () => ({ __esModule: true, isPlaceholderEmail: (e) => /placeholder|noemail/.test(e || '') }));

import { planSheet, planHalf, cropRect, PAGES, SOCIAL_FRAMES, unboundedEm, fitUnbounded, UNBOUNDED, STICKER } from '@/app/lib/cascade/render/flyers/plan';
import { normalizeFlyerData, zoneFor } from '@/app/lib/cascade/render/flyers/normalize';

const used = (p) => p.top + p.sticker + p.gap + p.word + p.nameGap + p.name + p.rowGap + p.row + p.pillGap + p.pill + p.tabsGap + p.tabs + p.bottom;

describe('planSheet', () => {
  const WORDS = { stamp: 'LOST' };

  test('the sticker takes the room the fixed blocks leave, and fills the width', () => {
    const p = planSheet(PAGES.LETTER, { aspect: 1.42 }, WORDS);
    expect(p.contentW).toBe(612 - 60);
    expect(p.sticker).toBeGreaterThan(320);
    expect(p.sticker).toBeLessThanOrEqual(p.contentW);
    // The last-seen map has a row of its own, beside the facts.
    expect(p.row).toBe(123);
    expect(p.mapW).toBe(240);
    expect(p.frame).toEqual({ w: p.sticker, h: p.sticker });
    expect(p.frameAspect).toBe(1);
    expect(p.focalAt).toBe(0.5);
    expect(Math.round(used(p))).toBe(792);
    expect(p.hasPhoto).toBe(true);
  });

  test('every photo is cut square: a tall one and a wide one get the same sticker', () => {
    const wide = planSheet(PAGES.LETTER, { aspect: 2.4 }, WORDS);
    const tall = planSheet(PAGES.LETTER, { aspect: 0.6 }, WORDS);
    expect(tall.sticker).toBe(wide.sticker);
    expect(tall.frameAspect).toBe(1);
  });

  test('no photo: the sticker stays, for the description', () => {
    const p = planSheet(PAGES.LETTER, null, WORDS);
    expect(p.hasPhoto).toBe(false);
    expect(p.frameAspect).toBeNull();
    expect(p.sticker).toBeGreaterThan(320);
  });

  test('the word is set as large as the width allows; FOUND is wider and shrinks', () => {
    const lost = planSheet(PAGES.LETTER, { aspect: 1.5 }, WORDS);
    const found = planSheet(PAGES.LETTER, { aspect: 1.5 }, { stamp: 'FOUND' });
    expect(lost.wordSize).toBe(88);
    expect(found.wordSize).toBe(88); // FOUND still fits a Letter sheet at full size
    expect(lost.word).toBeCloseTo(88 * UNBOUNDED.cap, 5);
    expect(Math.round(used(found))).toBe(792);
    // On a narrower line it shrinks, and the room goes to the sticker.
    expect(fitUnbounded('FOUND', 300, 88, 40)).toBeLessThan(fitUnbounded('LOST', 300, 88, 40));
  });

  test('Unbounded is measured from the file, so the word and the number never wrap', () => {
    // fontkit lays these out at 3.416 and 9.553 em with kerning; the table is within 2%, on the safe side.
    expect(unboundedEm('LOST') / 1.03).toBeGreaterThan(3.416 * 0.99);
    expect(unboundedEm('LOST') / 1.03).toBeLessThan(3.416 * 1.02);
    expect(unboundedEm('(512) 555-0100') / 1.03).toBeGreaterThan(9.553 * 0.99);
    expect(unboundedEm('(512) 555-0100') / 1.03).toBeLessThan(9.553 * 1.02);
    expect(fitUnbounded('LOST', 300, 88, 40)).toBeCloseTo(300 / unboundedEm('LOST'), 5);
    expect(fitUnbounded('LOST', 3000, 88, 40)).toBe(88);
    expect(fitUnbounded('FOUND', 10, 88, 40)).toBe(40);
  });

  test('the Letter sheet keeps tear tabs at the foot', () => {
    const p = planSheet(PAGES.LETTER, { aspect: 1.5 }, WORDS);
    expect(p.tabs).toBe(54);
    expect(p.tabsGap).toBe(12);
    // 10.5 plus the half-point the sticker's rounding leaves
    expect(p.bottom).toBeGreaterThanOrEqual(10.5);
    expect(p.bottom).toBeLessThan(12);
  });

  test('the poster scales the sheet, drops the tabs and gives the slack to the sticker', () => {
    const k = 792 / 612;
    const p = planSheet(PAGES.TABLOID, { aspect: 1.5 }, { k, tabs: false, ...WORDS });
    expect(p.tabs).toBe(0);
    expect(p.tabsGap).toBe(0);
    expect(p.wordSize).toBeCloseTo(88 * k, 5);
    // The sticker is held back by the width, so the slack goes above and below it equally.
    expect(p.sticker).toBe(Math.floor(p.contentW - 2 * STICKER.shadow * p.contentW));
    expect(p.bottom - 30 * k).toBeCloseTo(p.top - 36 * k, 5);
    expect(p.sticker).toBeGreaterThan(600);
    expect(Math.round(used(p))).toBe(1224);
  });
});

describe('planHalf', () => {
  test('two half sheets: the sticker beside the words', () => {
    const p = planHalf(PAGES.LETTER, { aspect: 0.8 }, { stamp: 'LOST' });
    expect(p.halfH).toBe(396);
    expect(p.sticker).toBe(300);
    expect(p.frame).toEqual({ w: 300, h: 300 });
    expect(p.frameAspect).toBe(1);
    expect(p.colX).toBeGreaterThan(15 + 300);
    expect(p.detailsW).toBe(612 - p.colX - 15);
    expect(p.hasPhoto).toBe(true);
    expect(p.wordSize).toBeGreaterThan(36);
  });

  test('a wide photo gets the same sticker; without a photo there is no crop', () => {
    expect(planHalf(PAGES.LETTER, { aspect: 1.5 }).frame).toEqual(planHalf(PAGES.LETTER, { aspect: 0.8 }).frame);
    const none = planHalf(PAGES.LETTER, null);
    expect(none.hasPhoto).toBe(false);
    expect(none.frameAspect).toBeNull();
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

  test('the face can sit above the middle of the frame when a layout wants it', () => {
    expect(cropRect(600, 1200, { x: 0.5, y: 0.6 }, 1, 0.5)).toEqual({ left: 0, top: 420, width: 600, height: 600 });
    expect(cropRect(600, 1200, { x: 0.5, y: 0.6 }, 1, 0.45)).toEqual({ left: 0, top: 450, width: 600, height: 600 });
    expect(cropRect(600, 1200, { x: 0.5, y: 0.1 }, 1, 0.45)).toEqual({ left: 0, top: 0, width: 600, height: 600 });
  });

  test('bad input gives no crop', () => {
    expect(cropRect(0, 0, null, 1)).toBeNull();
    expect(cropRect(100, 100, null, 0)).toBeNull();
  });

  test('the share image stickers are square cuts, the sizes the boards draw', () => {
    expect(SOCIAL_FRAMES.og).toEqual({ w: 500, h: 500, focalAt: 0.5 });
    expect(SOCIAL_FRAMES.square).toEqual({ w: 480, h: 480, focalAt: 0.5 });
    expect(SOCIAL_FRAMES.story).toEqual({ w: 760, h: 760, focalAt: 0.5 });
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
    lastSeenLatitude: 30.2638,
    lastSeenLongitude: -97.7716,
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
    expect(d.stamp).toBe('LOST');
    expect(d.coverLine).toBe('Max, a golden retriever');
    expect(normalizeFlyerData({ ...MAX, petBreed: 'Unknown', petSpecies: 'CAT' }, {}).coverLine).toBe('Max, a cat');
    expect(normalizeFlyerData({ ...MAX, petBreed: 'Australian shepherd' }, {}).coverLine).toBe('Max, an australian shepherd');
    expect(d.speciesLabel).toBe('DOG');
    expect(d.factsLine).toBe('Golden Retriever · Large · 4 years old · Microchipped');
    expect(d.lookFor).toBe('Golden coat. White patch on the chest. Blue, with a bone tag.');
    expect(d.ifYouSee).toBe("Max is probably frightened and hiding. Please don't chase or call out. Note the exact spot and call or text Avery right away.");
    expect(d.contactValue).toBe('(512) 555-0100');
    expect(d.contactSecondary).toBe('avery@example.com');
    expect(d.reward).toBe('$500');
    expect(d.lastSeenArea).toBe('2100 Barton Springs Rd, Austin');
    expect(d.lastSeenWhen).toBe('Mon, Nov 2');
    expect(d.lastSeenDate).toBe('Nov 2, 2026');
    expect(d.caseUrlLabel).toBe('reunitepets.org/cases/AUS-2026-0001');
  });

  test('the date is the local date where the pet was lost, and never a clock time', () => {
    // 8 pm in Austin on the 4th is 2 am UTC on the 5th. The wizard stores a
    // band's middle as the time, so a clock time would be made up anyway.
    const evening = normalizeFlyerData({ ...MAX, lastSeenAt: new Date('2026-11-05T02:00:00Z') }, {});
    expect(evening.lastSeenWhen).toBe('Wed, Nov 4');
    expect(zoneFor(MAX)).toBe('America/Chicago');
    expect(zoneFor({ lastSeenLatitude: 34.0099, lastSeenLongitude: -118.27 })).toBe('America/Los_Angeles');
    expect(zoneFor({ lastSeenLatitude: -16.5, lastSeenLongitude: -68.15 })).toBe('America/La_Paz');
    // No point on record: Central, the site's home zone, not the server's UTC.
    expect(zoneFor({})).toBe('America/Chicago');
    expect(zoneFor({ lastSeenLatitude: 0, lastSeenLongitude: 0 })).toBe('America/Chicago');
  });

  test('a description that only repeats the color and the species is left out', () => {
    const d = normalizeFlyerData(
      { ...MAX, petBreed: 'Unknown', petColor: 'white, White', petDescription: 'white, White Dog', pet: null },
      {}
    );
    expect(d.lookFor).toBe('White, White coat.');
    const e = normalizeFlyerData({ ...MAX, petBreed: 'Unknown', petColor: 'Black', petDescription: 'Black lab, limps on the left hind leg', pet: null }, {});
    expect(e.lookFor).toBe('Black coat. Black lab, limps on the left hind leg.');
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
