/**
 * The flyer's layout rules (app/lib/cascade/render/flyers/plan.js) and the
 * words it is built from (normalize.js): the photo takes the room that is
 * left, the full width of the page, and the crop keeps the pet in it.
 */

jest.mock('@/app/lib/placeholderEmail', () => ({ __esModule: true, isPlaceholderEmail: (e) => /placeholder|noemail/.test(e || '') }));

import { planSheet, planHalf, cropRect, PAGES, SOCIAL_FRAMES, unboundedEm, fitUnbounded, UNBOUNDED, STICKER, bandBox, printInner, BAND } from '@/app/lib/cascade/render/flyers/plan';
import { normalizeFlyerData, zoneFor } from '@/app/lib/cascade/render/flyers/normalize';

const used = (p) => p.top + p.photo.h + p.gap + p.word + p.nameGap + p.name + p.rowGap + p.row + p.adviceGap + p.advice + p.contactGap + p.contact + p.tabsGap + p.tabs + p.bottom;

describe('planSheet', () => {
  const WORDS = { stamp: 'LOST' };

  test('the photo takes the room the fixed blocks leave, the full width of the sheet', () => {
    const p = planSheet(PAGES.LETTER, { aspect: 1.42 }, WORDS);
    expect(p.contentW).toBe(612 - 60);
    expect(p.photo.w).toBe(p.contentW);
    expect(p.photo.h).toBeGreaterThan(270);
    expect(p.photo.h).toBeLessThanOrEqual(p.contentW);
    // The last-seen map has a row of its own, beside the facts; "If you see" its note card under that; the contact panel last.
    expect(p.row).toBe(110);
    expect(p.mapW).toBe(240);
    expect(p.advice).toBe(82);
    expect(p.contact).toBe(84);
    expect(p.frame).toEqual({ w: p.contentW, h: p.photo.h });
    // The picture sits inside the print's navy edge and cream mat; the crop has that shape.
    const inner = printInner(p.contentW, p.photo.h, 1);
    expect(inner).toEqual({ edge: 2, mat: 4, w: p.contentW - 12, h: p.photo.h - 12 });
    expect(p.frameAspect).toBeCloseTo(inner.w / inner.h, 5);
    expect(p.focalAt).toBe(0.42);
    expect(Math.round(used(p))).toBe(792);
    expect(p.hasPhoto).toBe(true);
    // The caution stripes run along the head only: the foot is the tear tabs.
    expect(p.stripe).toBe(12);
    expect(p.foot).toBe(false);
  });

  test('every photo is cut to the print: a tall one and a wide one get the same frame', () => {
    const wide = planSheet(PAGES.LETTER, { aspect: 2.4 }, WORDS);
    const tall = planSheet(PAGES.LETTER, { aspect: 0.6 }, WORDS);
    expect(tall.frame).toEqual(wide.frame);
    expect(tall.frameAspect).toBe(wide.frameAspect);
  });

  test('no photo: the print stays, for the description', () => {
    const p = planSheet(PAGES.LETTER, null, WORDS);
    expect(p.hasPhoto).toBe(false);
    expect(p.frameAspect).toBeNull();
    expect(p.photo.h).toBeGreaterThan(270);
  });

  test('the word is set as large as the width allows, on its band; FOUND is wider and shrinks', () => {
    const lost = planSheet(PAGES.LETTER, { aspect: 1.5 }, WORDS);
    const found = planSheet(PAGES.LETTER, { aspect: 1.5 }, { stamp: 'FOUND' });
    expect(lost.wordSize).toBe(72);
    expect(found.wordSize).toBe(72); // FOUND still fits a Letter sheet at full size
    // The block is the band (the caps with air above and below) plus its hard shadow.
    expect(lost.band).toEqual(bandBox(72, 'LOST'));
    expect(lost.band.h).toBeCloseTo(72 * (UNBOUNDED.cap + 2 * BAND.pad), 5);
    expect(lost.band.w).toBeCloseTo((unboundedEm('LOST') / 1.03) * 72 + 2 * BAND.padX * 72, 5);
    expect(lost.band.off).toBe(4);
    expect(lost.word).toBeCloseTo(lost.band.h + lost.band.off, 5);
    expect(found.band.w).toBeGreaterThan(lost.band.w);
    expect(Math.round(used(found))).toBe(792);
    // On a narrower line it shrinks, and the room goes to the photo.
    expect(fitUnbounded('FOUND', 300, 72, 40)).toBeLessThan(fitUnbounded('LOST', 300, 72, 40));
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
    expect(p.tabs).toBe(48);
    expect(p.tabsGap).toBe(10);
    // 10.5 plus the half-point the photo's rounding leaves
    expect(p.bottom).toBeGreaterThanOrEqual(10.5);
    expect(p.bottom).toBeLessThan(12);
  });

  test('the poster scales the sheet, drops the tabs and gives the slack to the print', () => {
    const k = 792 / 612;
    const p = planSheet(PAGES.TABLOID, { aspect: 1.5 }, { k, tabs: false, ...WORDS });
    expect(p.tabs).toBe(0);
    expect(p.tabsGap).toBe(0);
    expect(p.wordSize).toBeCloseTo(72 * k, 5);
    // Never taller than the sheet is wide; any slack goes above and below it equally.
    expect(p.photo.h).toBeLessThanOrEqual(p.contentW);
    expect(p.bottom - 30 * k).toBeCloseTo(p.top - 26 * k, 5);
    expect(p.photo.h).toBeGreaterThan(600);
    expect(Math.round(used(p))).toBe(1224);
    // No tabs: the caution stripes run along the foot as well as the head.
    expect(p.stripe).toBeCloseTo(12 * k, 5);
    expect(p.foot).toBe(true);
  });
});

describe('planHalf', () => {
  test('the print stands beside the words, the full height of the half sheet', () => {
    const p = planHalf(PAGES.LETTER, { aspect: 0.8 }, { stamp: 'LOST' });
    expect(p.halfH).toBe(396);
    expect(p.photo).toEqual({ w: 270, h: 396 - 30 - 3 });
    expect(p.frame).toEqual(p.photo);
    const inner = printInner(270, 363, 0.8);
    expect(inner).toEqual({ edge: 1.6, mat: 3, w: 270 - 9.2, h: 363 - 9.2 });
    expect(p.frameAspect).toBeCloseTo(inner.w / inner.h, 5);
    expect(p.colX).toBe(15 + 270 + 6 + 15);
    expect(p.detailsW).toBe(612 - p.colX - 15);
    expect(p.wordSize).toBeLessThanOrEqual(56);
    expect(p.band).toEqual(bandBox(p.wordSize, 'LOST'));
    expect(p.stripe).toBe(7);
    expect(p.mapH).toBe(66);
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

  test('the share image prints are the cuts the boards draw', () => {
    expect(SOCIAL_FRAMES.og).toEqual({ w: 520, h: 514, focalAt: 0.42, x: 56, y: 58, band: 16 });
    expect(SOCIAL_FRAMES.square).toEqual({ w: 1000, h: 430, focalAt: 0.42, x: 40, y: 44, band: 18 });
    expect(SOCIAL_FRAMES.story).toEqual({ w: 968, h: 700, focalAt: 0.42, x: 56, y: 140, band: 22 });
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
    // No questionnaire on the report: the species' general line, which is "don't chase" either way.
    expect(d.ifYouSee).toBe("Don't chase. A frightened dog runs farther. Note the exact spot and time and call us right away.");
    expect(d.health).toBe('');
    expect(d.needsMedication).toBe(false);
    expect(d.contactValue).toBe('(512) 555-0100');
    expect(d.contactSecondary).toBe('avery@example.com');
    expect(d.email).toBe('avery@example.com');
    expect(d.reward).toBe('$500');
    // No reward: no tag on the sticker, nothing else moves.
    expect(normalizeFlyerData({ ...MAX, hasReward: false, rewardAmount: null }, {}).reward).toBeNull();
    expect(normalizeFlyerData({ ...MAX, rewardAmount: null }, {}).reward).toBe('REWARD');
    expect(d.lastSeenArea).toBe('2100 Barton Springs Rd, Austin');
    expect(d.lastSeenWhen).toBe('Mon, Nov 2');
    expect(d.lastSeenDate).toBe('Nov 2, 2026');
    // The line a stranger types: the domain and the case number's suffix.
    expect(d.caseUrlLabel).toBe('reunitepets.org/p/0001');
    expect(normalizeFlyerData({ ...MAX, caseNumber: 'MUN-2026-HF27J2' }, {}).caseUrlLabel).toBe('reunitepets.org/p/HF27J2');
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

  test('no phone: the short link is the way to report; a placeholder email is no email', () => {
    const d = normalizeFlyerData({ ...MAX, ownerPhone: 'Not provided', ownerEmail: 'x@placeholder.test' }, {});
    expect(d.hasPhone).toBe(false);
    expect(d.email).toBe('');
    expect(d.contactValue).toBe('reunitepets.org/p/0001');
    expect(d.ifYouSee).toMatch(/^Don't chase\./);
    const e = normalizeFlyerData({ ...MAX, ownerPhone: 'Not provided' }, {});
    expect(e.contactValue).toBe('avery@example.com');
    expect(e.email).toBe('avery@example.com');
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

describe('the questionnaire on the flyer (app/lib/caseDetails.js)', () => {
  const MAX = {
    caseNumber: 'AUS-2026-0001',
    reportType: 'LOST',
    petName: 'Max',
    petSpecies: 'DOG',
    petBreed: 'Golden Retriever',
    petColor: 'Golden',
    petSize: 'LARGE',
    lastSeenAddress: '2100 Barton Springs Rd, Austin, TX 78704',
    lastSeenAt: new Date('2026-11-02T18:30:00Z'),
    ownerName: 'Avery Jones',
    ownerPhone: '5125550100',
    ownerEmail: 'avery@example.com',
    pet: { age: 4, microchipId: '985141', distinctiveMarks: 'white patch on the chest', collarInfo: 'blue, with a bone tag' },
    details: {
      temperament: 'SCARED',
      fears: ['MEN'],
      health: ['DIABETIC'],
      healthNote: 'insulin twice a day',
      collar: 'COLLAR',
      collarColor: 'red',
      tag: 'PHONE',
      leash: true,
      marks: ['white_chest', 'one_ear_up'],
      sex: 'MALE',
      fixed: 'NO',
      ageBand: 'SENIOR',
      lure: ['NAME', 'TREATS'],
    },
    needsMedication: true,
  };

  test('the answers write what to do, what to look for and the facts; the old Pet-row words step aside', () => {
    const d = normalizeFlyerData(MAX, {});
    expect(d.ifYouSee).toBe("Don't chase, call out or stare. Max will run. Sit or crouch sideways, toss food if you have some, and call us right away with the exact spot. Max is afraid of men.");
    expect(d.health).toBe('Needs insulin twice a day. Please call the moment you see Max.');
    expect(d.needsMedication).toBe(true);
    expect(d.lookFor).toBe('Golden coat. Red collar, a tag with our number. Dragging a leash. White chest, one ear up.');
    expect(d.factsLine).toBe('Golden Retriever · Large · Male, not neutered · Senior · Microchipped');
    expect(d.comesTo).toBe('Comes to their name and treats or a shaken food bag.');
  });

  test("the owner's own words win, and a healthy, friendly pet gets a friendly line and no tag", () => {
    const d = normalizeFlyerData({ ...MAX, needsMedication: false, details: { temperament: 'FRIENDLY', approachNote: 'he comes to "biscuit"', health: ['NONE'], collar: 'NONE' } }, {});
    expect(d.ifYouSee).toBe('He comes to "biscuit".');
    expect(d.health).toBe('');
    expect(d.needsMedication).toBe(false);
    expect(d.lookFor).toBe('Golden coat. No collar.');
    expect(d.factsLine).toBe('Golden Retriever · Large · 4 years old · Microchipped');
  });
});
