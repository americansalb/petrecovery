/**
 * The flyer's layout rules (app/lib/cascade/render/flyers/plan.js) and the
 * words it is built from (normalize.js): the photo takes the room that is
 * left, the full width of the page, and the crop keeps the pet in it.
 */

jest.mock('@/app/lib/placeholderEmail', () => ({ __esModule: true, isPlaceholderEmail: (e) => /placeholder|noemail/.test(e || '') }));

import { planSheet, planHalf, cropRect, PAGES, SOCIAL_FRAMES, frauncesEm, frauncesItalicEm, fitFraunces, FOCAL_AT } from '@/app/lib/cascade/render/flyers/plan';
import { normalizeFlyerData, zoneFor } from '@/app/lib/cascade/render/flyers/normalize';

const used = (p) => p.frame.h + p.panelTop + p.wordH + p.gapA + p.lastSeen + p.gapB + p.facts + p.gapC + p.contact + p.tabsGap + p.tabs + p.bottom;

describe('planSheet', () => {
  const WORDS = { stamp: 'LOST', coverLine: 'Milo, a tabby cat' };

  test('the photo bleeds the full width and takes what the fixed blocks leave', () => {
    const p = planSheet(PAGES.LETTER, { aspect: 1.42 }, WORDS);
    expect(p.frame.w).toBe(612);
    expect(Math.round(used(p))).toBe(792);
    expect(p.frame.h).toBeGreaterThan(400);
    expect(p.frameAspect).toBeCloseTo(612 / p.frame.h, 5);
    expect(p.hasPhoto).toBe(true);
    expect(p.focalAt).toBe(FOCAL_AT);
  });

  test('a tall photo gets the same frame: it is cut to it around the pet, never matted', () => {
    const wide = planSheet(PAGES.LETTER, { aspect: 2.4 }, WORDS);
    const tall = planSheet(PAGES.LETTER, { aspect: 0.6 }, WORDS);
    expect(tall.frame).toEqual(wide.frame);
    expect(tall.frameAspect).toBeCloseTo(wide.frameAspect, 5);
  });

  test('no photo: the frame stays, for the description', () => {
    const p = planSheet(PAGES.LETTER, null, WORDS);
    expect(p.hasPhoto).toBe(false);
    expect(p.frameAspect).toBeNull();
    expect(p.frame.h).toBeGreaterThan(400);
  });

  test('LOST and the cover line share one line while the line fits; a long line goes under the word', () => {
    const short = planSheet(PAGES.LETTER, { aspect: 1.5 }, WORDS);
    expect(short.word.stacked).toBe(false);
    expect(short.word.wordSize).toBe(124);
    expect(short.word.lineSize).toBeGreaterThanOrEqual(15);
    const long = planSheet(PAGES.LETTER, { aspect: 1.5 }, { stamp: 'LOST', coverLine: 'Clementine, a holland lop rabbit with one ear' });
    expect(long.word.stacked).toBe(true);
    expect(long.word.wordSize).toBe(124);
    expect(long.wordH).toBeGreaterThan(short.wordH);
    // The photo gives up the second line's height.
    expect(long.frame.h).toBeLessThan(short.frame.h);
    expect(Math.round(used(long))).toBe(792);
  });

  test('Fraunces is measured from the file, so the word, the line and the number never wrap', () => {
    // fontkit lays these out at 2.859, 7.798 and 7.577 em; the tables are within 1%.
    expect(frauncesEm('LOST') / 1.03).toBeGreaterThan(2.859 * 0.99);
    expect(frauncesEm('LOST') / 1.03).toBeLessThan(2.859 * 1.01);
    expect(frauncesEm('(512) 555-0100') / 1.03).toBeGreaterThan(7.798 * 0.99);
    expect(frauncesEm('(512) 555-0100') / 1.03).toBeLessThan(7.798 * 1.01);
    expect(frauncesItalicEm('Milo, a tabby cat') / 1.03).toBeGreaterThan(7.577 * 0.99);
    expect(frauncesItalicEm('Milo, a tabby cat') / 1.03).toBeLessThan(7.577 * 1.01);
    expect(fitFraunces('LOST', 300, 124, 60)).toBeCloseTo(300 / frauncesEm('LOST'), 5);
    expect(fitFraunces('LOST', 3000, 124, 60)).toBe(124);
    expect(fitFraunces('FOUND', 10, 124, 60)).toBe(60);
  });

  test('the Letter sheet keeps tear tabs at the foot', () => {
    const p = planSheet(PAGES.LETTER, { aspect: 1.5 }, WORDS);
    expect(p.tabs).toBe(54);
    expect(p.tabsGap).toBe(12);
    expect(p.bottom).toBe(9);
  });

  test('the poster scales the sheet, drops the tabs and keeps a margin at the foot', () => {
    const k = 792 / 612;
    const p = planSheet(PAGES.TABLOID, { aspect: 1.5 }, { k, tabs: false, ...WORDS });
    expect(p.tabs).toBe(0);
    expect(p.tabsGap).toBe(0);
    expect(p.word.wordSize).toBeCloseTo(124 * k, 5);
    expect(p.bottom).toBeCloseTo(30 * k, 5);
    expect(Math.round(used(p))).toBe(1224);
    expect(p.frame.h).toBeGreaterThan(800);
  });
});

describe('planHalf', () => {
  test('two half sheets: the photo is a column beside the words', () => {
    const p = planHalf(PAGES.LETTER, { aspect: 0.8 }, { stamp: 'LOST', coverLine: 'Milo, a tabby cat' });
    expect(p.halfH).toBe(396);
    expect(p.photoW).toBe(300);
    expect(p.frame.h).toBe(396 - 15 * 2 - 3);
    expect(p.frameAspect).toBeCloseTo(300 / p.frame.h, 5);
    expect(p.detailsW).toBe(612 - 15 * 3 - 300);
    expect(p.hasPhoto).toBe(true);
    expect(p.word.wordSize).toBeGreaterThan(40);
  });

  test('a wide photo gets the same column; without a photo there is no crop', () => {
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

  test('the face can sit above the middle of the frame, so a word under the photo is not under the chin', () => {
    // Focal point at 60% down a 1200 px photo, frame 600 tall: centered puts the
    // face at 300; at 0.45 the face sits at 270 and the cut starts lower.
    expect(cropRect(600, 1200, { x: 0.5, y: 0.6 }, 1, 0.5)).toEqual({ left: 0, top: 420, width: 600, height: 600 });
    expect(cropRect(600, 1200, { x: 0.5, y: 0.6 }, 1, 0.45)).toEqual({ left: 0, top: 450, width: 600, height: 600 });
    expect(cropRect(600, 1200, { x: 0.5, y: 0.1 }, 1, 0.45)).toEqual({ left: 0, top: 0, width: 600, height: 600 });
  });

  test('bad input gives no crop', () => {
    expect(cropRect(0, 0, null, 1)).toBeNull();
    expect(cropRect(100, 100, null, 0)).toBeNull();
  });

  test('the share image frames are the sizes the boards draw, with the face just above the middle', () => {
    expect(SOCIAL_FRAMES.og).toEqual({ w: 690, h: 630, focalAt: FOCAL_AT });
    expect(SOCIAL_FRAMES.square).toEqual({ w: 1080, h: 640, focalAt: FOCAL_AT });
    expect(SOCIAL_FRAMES.story).toEqual({ w: 1080, h: 1150, focalAt: FOCAL_AT });
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
