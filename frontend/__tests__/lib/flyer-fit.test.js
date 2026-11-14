/**
 * No line on a flyer or a share picture that has to be read whole is wider
 * than its box.
 *
 * Founder, 2026-11-13, holding a flyer whose email ran across the QR code:
 * "do I need to individually inspect every PDF this should not even be
 * possible". It was possible because a fitted size had a floor: a long
 * email shrank to the floor, was still wider than its column, and an email
 * is one word, so it could not wrap or be cut.
 *
 * Nobody should have to look at each PDF. So this measures the real font
 * files, letter by letter, and holds the layout to them: the widths the
 * layout reckons with are never narrower than the fonts, and the contact
 * panel's lines fit their column for every size of sheet and every awkward
 * email, phone and name tried here.
 */
import path from 'path';
import * as fontkit from 'fontkit';
import { unboundedEm, interBoldEm, wholeUnbounded, wholeInter, wholeLine, planContact, DISPLAY_MIN } from '@/app/lib/cascade/render/flyers/plan';

const FONTS = path.join(process.cwd(), 'app', 'lib', 'cascade', 'render', 'fonts');
const open = (file) => fontkit.openSync(path.join(FONTS, file));
const FACE = { Unbounded: open('Unbounded-900.ttf'), Inter: open('Inter-Bold.ttf'), InterMedium: open('Inter-Medium.ttf') };
/** The real width of `text` in ems, as the font file sets it. Kept, because the same lines are measured many times. */
const measured = new Map();
function realEm(font, text) {
  const key = `${font.postscriptName}|${text}`;
  if (!measured.has(key)) measured.set(key, font.layout(String(text)).advanceWidth / font.unitsPerEm);
  return measured.get(key);
}

const EMAILS = [
  'avery@example.org',
  'avery.longlastname@examplerescue.org',
  'wwwwmmmm.wwwwmmmm@mmmmwwww-mmmmwwww.com',
  'MAXIMILIANO.FERNANDEZ.DE.LA.VEGA@UNIVERSIDAD-NACIONAL.EDU.MX',
  'a.very.long.address.with.many.parts.and.dots@a-subdomain.of.another-long-domain.example.co.uk',
  'iiiillll.1111@iiii.li',
  `${'m'.repeat(64)}@${'w'.repeat(60)}.com`,
];
const PHONES = ['(512) 555-0100', '+52 55 5555 0100', '+44 20 7946 0958 ext. 4400', '5125550100'];
const LINKS = ['reunitepets.org/p/HF27J2', 'reunitepets.org/p/WWWWWW', 'reunitepets.org/p/MMMM88'];
const NAMES = ['Max', 'LaloBabo', 'Sir Barksalot the Third of Westminster', 'WWWWWWWWWWWWWWWWWWWW', 'Señor Ñandú Ünïcödé'];

describe('the widths the layout reckons with are never narrower than the fonts', () => {
  test('Unbounded, the display face', () => {
    for (const text of [...EMAILS, ...PHONES, ...LINKS, ...NAMES]) {
      expect(unboundedEm(text)).toBeGreaterThanOrEqual(realEm(FACE.Unbounded, text));
    }
  });

  test('Inter at its boldest single-line weight, and at the weight of "or email"', () => {
    for (const text of [...EMAILS, ...PHONES, ...LINKS, ...NAMES, ...EMAILS.map((e) => `or email ${e}`), ...NAMES.map((n) => `${n} · LOST`)]) {
      expect(interBoldEm(text)).toBeGreaterThanOrEqual(realEm(FACE.Inter, text));
      expect(interBoldEm(text)).toBeGreaterThanOrEqual(realEm(FACE.InterMedium, text));
    }
  });
});

describe('a line that has to be read whole has no smallest size', () => {
  test('whatever the text, the size given fits the width asked', () => {
    for (const text of [...EMAILS, ...PHONES, ...LINKS]) {
      for (const maxW of [40, 120, 291, 540]) {
        expect(wholeUnbounded(text, maxW, 34.5) * realEm(FACE.Unbounded, text)).toBeLessThanOrEqual(maxW);
        expect(wholeInter(text, maxW, 34.5) * realEm(FACE.Inter, text)).toBeLessThanOrEqual(maxW);
        const line = wholeLine(text, maxW, 34.5);
        expect(line.size * realEm(FACE[line.face], text)).toBeLessThanOrEqual(maxW);
      }
    }
  });

  test('a short phone number keeps the display face at full size, and a long email is set in Inter instead of tiny display type', () => {
    expect(wholeLine('(512) 555-0100', 291, 34.5)).toEqual({ face: 'Unbounded', size: expect.any(Number) });
    expect(wholeLine('(512) 555-0100', 291, 34.5).size).toBeGreaterThan(20);
    const email = wholeLine('avery.longlastname@examplerescue.org', 291, 34.5);
    expect(email.face).toBe('Inter');
    expect(email.size).toBeGreaterThan(wholeUnbounded('avery.longlastname@examplerescue.org', 291, 34.5));
    expect(DISPLAY_MIN).toBeGreaterThan(10);
  });
});

describe('the contact panel: every line fits its column on every sheet and picture', () => {
  const people = [];
  for (const email of EMAILS) {
    people.push({ hasPhone: false, email, contactValue: email });
    for (const phone of PHONES) people.push({ hasPhone: true, email, contactValue: phone });
  }
  for (const link of LINKS) people.push({ hasPhone: false, email: '', contactValue: link });
  // The letter sheet, the poster, the half sheet's narrow column, and the share pictures in pixels.
  const boxes = [];
  for (const w of [250, 300, 540, 720, 1000]) for (const kBase of [0.8, 1, 1.42, 1.55, 1.9]) for (const scale of [1, 1.2, 1.35]) for (const stacked of [false, true]) boxes.push({ w, kBase, scale, stacked });

  test('the eyebrow, the main line and "or email" are never wider than the column, and the column, the QR code and the link never wider than the panel', () => {
    let checked = 0;
    for (const person of people) {
      for (const petName of NAMES) {
        for (const box of boxes) {
          for (const round of [(n) => n, Math.round]) {
            const data = { ...person, petName, qrDataUrl: 'data:image/png;base64,AAAA', caseUrlLabel: LINKS[1] };
            const eyebrow = `Seen ${petName}? ${person.hasPhone ? 'Call or text, any hour' : person.email ? 'Email, any hour' : 'Report it at'}`;
            const p = planContact({ data, ...box, eyebrow, linkEyebrow: 'Report a sighting', round });
            expect(p.leftW).toBeGreaterThan(0);
            expect(p.main.size * realEm(FACE[p.main.face], data.contactValue)).toBeLessThanOrEqual(p.leftW);
            if (p.emailLine) expect(p.emailSize * realEm(FACE.InterMedium, p.emailLine)).toBeLessThanOrEqual(p.leftW);
            // The eyebrow is capitals with its letters spaced out by 0.14 of its size.
            const caps = eyebrow.toUpperCase();
            expect(p.eyebrowSize * (realEm(FACE.Inter, caps) + 0.14 * caps.length)).toBeLessThanOrEqual(p.leftW);
            // Whatever the size of the sheet: the column, the QR code and the link together are never wider than the panel.
            if (!box.stacked) expect(p.padX * 2 + p.leftW + p.qr + p.qrGap + p.linkW + p.linkGap).toBeLessThanOrEqual(box.w + 0.001);
            if (!box.stacked) expect(p.leftW).toBeGreaterThanOrEqual((box.w - p.padX * 2) * 0.3);
            if (p.link) expect(p.linkSize * realEm(FACE.Inter, p.link)).toBeLessThanOrEqual(p.linkW);
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(20000);
  });

  test('the sheets and the pictures use this one plan, and neither sets a floor under a whole line', () => {
    const fs = require('fs');
    const flyer = fs.readFileSync(path.join(process.cwd(), 'app/lib/cascade/render/flyers/Flyer.jsx'), 'utf8');
    const card = fs.readFileSync(path.join(process.cwd(), 'app/lib/cascade/render/social/Card.jsx'), 'utf8');
    for (const source of [flyer, card]) {
      expect(source).toMatch(/planContact\(\{ data, w, kBase, scale/);
      // The old way: a floor under the phone or the email, which is how one was drawn across the QR code.
      expect(source).not.toMatch(/fit(Unbounded|Inter)\(data\.(contactValue|caseUrlLabel|email)/);
      expect(source).not.toMatch(/fitInter\(emailLine/);
    }
    expect(flyer).toMatch(/fontSize: wholeInter\(first, tabW - 8, 7\.5\)/);
  });
});
