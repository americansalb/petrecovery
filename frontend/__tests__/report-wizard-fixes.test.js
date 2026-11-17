/**
 * What testing before publishing found in the report forms, and what holds it.
 *
 *  - A signed-in owner was never asked for a phone, so the case was saved with
 *    "Not provided" and the flyer said "Then call or text us" with only an
 *    email. The form now asks the phone finders call, prefilled with the
 *    account's, and does not post without one.
 *  - A guest's one-search limit showed only when Post was refused, after every
 *    screen. The form now asks first (GET /api/owner/open-search) and tells them
 *    before the first question, with the link to the search they have.
 *  - The review flyer cut a long name ("Senor Bigotes de la Ca...") under "This
 *    is what gets printed", while the printed sheet showed all of it.
 *  - The found form's "Anything distinctive?" had no limit (3,090 letters).
 */

import fs from 'fs';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';

jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: { case: { findMany: jest.fn(), findUnique: jest.fn() } } }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { mintOwnerKey, openSearchesMadeHere } from '@/app/lib/ownerKey';
import { GET as openSearch } from '@/app/api/owner/open-search/route';
import FlyerPreview, { fitNameLine, coverLine, NAME_PT } from '@/app/components/report/FlyerPreview';
import { OwnerPhoneField } from '@/app/components/report/ContactFields';
import TagDetailsStep, { MARKS_MAX } from '@/app/components/report/found/TagDetailsStep';
import OpenSearchNotice from '@/app/components/report/OpenSearchNotice';
import { placeholderEmailForPhone } from '@/app/lib/placeholderEmail';
import { fitInter } from '@/app/lib/cascade/render/flyers/plan';
import { lostScreenOrder } from '@/app/components/report/lost/screens';

const APP = path.join(__dirname, '..', 'app');
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8');
const wizard = read('report/new/page.js');

describe('a signed-in owner is asked the phone finders call', () => {
  test('the phone takes the contact screen\'s place, just before the review', () => {
    // Seven screens (founder, 2026-11-17); the reward is asked after posting now.
    expect(lostScreenOrder({ isLoggedIn: true })).toEqual(['photo', 'pet', 'color', 'place', 'behaviour', 'phone', 'review']);
    expect(lostScreenOrder({ isLoggedIn: true, hasPets: true })).toEqual(['pet', 'photo', 'color', 'place', 'behaviour', 'phone', 'review']);
    expect(lostScreenOrder({ isLoggedIn: false })).toEqual(['photo', 'pet', 'color', 'place', 'behaviour', 'contact', 'review']);
    // It is counted in the progress and kept when a draft is resumed.
    expect(wizard).toMatch(/lostScreenOrder\(\{ isLoggedIn, hasPets \}\)/);
    expect(wizard).toMatch(/phone: isValidPhone\(d\.contact\?\.phone\)/);
  });

  test('it is prefilled with the account\'s phone when the account has one', () => {
    expect(wizard).toMatch(/fetch\('\/api\/profile'\)/);
    expect(wizard).toMatch(/data\?\.user\?\.phone/);
  });

  test('Continue waits for a phone, and Post does not go without one', () => {
    expect(wizard).toMatch(/stepId === 'phone'[\s\S]*?disabled: !isValidPhone\(contact\.phone\)/);
    expect(wizard).toMatch(/if \(isLoggedIn && !isValidPhone\(contact\.phone\)\)/);
  });

  test('the report and the flyer carry it, for a signed-in owner too', () => {
    expect(wizard).toMatch(/const effectivePhone = contact\.phone\.trim\(\);/);
    expect(wizard).toMatch(/phone: isLoggedIn \|\| contact\.method === 'phone' \? contact\.phone : ''/);
    // The review lists it, one tap from changing it.
    expect(wizard).toMatch(/id: 'phone',\s*icon: Phone,\s*label: 'Finders call'/);
  });

  test('the flyer with that phone says to call or text, with the number', () => {
    const html = renderToStaticMarkup(<FlyerPreview species="CAT" petName="Mia" phone="5125550100" email="sam@example.com" />);
    expect(html).toContain('Seen Mia? Call or text, any hour');
    expect(html).toContain('(512) 555-0100');
  });

  test('the phone field marks a number with fewer than ten digits as not done', () => {
    const short = renderToStaticMarkup(<OwnerPhoneField value="555 01" onChange={() => {}} />);
    expect(short).toContain('border-red-300');
    const ok = renderToStaticMarkup(<OwnerPhoneField value="(512) 555-0100" onChange={() => {}} />);
    expect(ok).not.toContain('border-red-300');
    expect(ok).toContain('type="tel"');
  });
});

describe("a guest is told at the start that a search is already open", () => {
  const mine = mintOwnerKey();
  const OPEN = { id: 'case-1', caseNumber: 'AUS-2026-0001', petName: 'Mia', status: 'ACTIVE', reportType: 'LOST', expiresAt: null, ownerKeyHash: mine.hash, ownerKeyAt: new Date() };
  const made = `rp_owner_case-1=${mine.key}; rp_made_case-1=1`;
  const ask = (cookie) => openSearch(new Request('http://localhost/api/owner/open-search', { headers: cookie ? { cookie } : {} }));

  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue(null);
    prisma.case.findMany.mockResolvedValue([OPEN]);
    prisma.case.findUnique.mockResolvedValue({ reporter: { email: 'sam@example.com' } });
  });

  test('the search this browser made is named, with the link to it', async () => {
    const res = await ask(made);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ open: { caseNumber: 'AUS-2026-0001', petName: 'Mia', url: '/mission-control?mission=AUS-2026-0001', hasEmail: true, lostAt: null } });
  });

  test('it says when the pet was lost, for the strip under the top bar, and names the newest search', async () => {
    const other = mintOwnerKey();
    const lost = new Date('2026-11-14T18:30:00Z');
    prisma.case.findMany.mockResolvedValue([
      { ...OPEN, createdAt: new Date('2026-11-14T19:00:00Z'), lastSeenAt: lost },
      { ...OPEN, id: 'case-0', caseNumber: 'AUS-2026-0000', petName: 'Old', createdAt: new Date('2026-11-01T10:00:00Z'), lastSeenAt: new Date('2026-11-01T09:00:00Z'), ownerKeyHash: other.hash },
    ]);
    const body = await (await ask(`rp_owner_case-0=${other.key}; rp_made_case-0=1; ${made}`)).json();
    expect(body.open).toMatchObject({ caseNumber: 'AUS-2026-0001', petName: 'Mia', lostAt: lost.toISOString() });
    // Without a last-seen time, when the report was made.
    prisma.case.findMany.mockResolvedValue([{ ...OPEN, createdAt: new Date('2026-11-14T19:00:00Z'), lastSeenAt: null }]);
    expect((await (await ask(made)).json()).open.lostAt).toBe('2026-11-14T19:00:00.000Z');
  });

  test('it says whether the search has an email mail can go to, never the address', async () => {
    const body = await (await ask(made)).json();
    expect(JSON.stringify(body)).not.toContain('sam@example.com');
    expect(prisma.case.findUnique).toHaveBeenCalledWith({ where: { id: 'case-1' }, select: { reporter: { select: { email: true } } } });
    // A phone-only report's account has a placeholder address; an old one may have the words "Not provided".
    for (const email of [placeholderEmailForPhone('512 555 0100'), 'Not provided', null]) {
      prisma.case.findUnique.mockResolvedValue({ reporter: email ? { email } : null });
      expect((await (await ask(made)).json()).open.hasEmail).toBe(false);
    }
  });

  test('a guest who gave only a phone is not told to set a password with an email they never gave', () => {
    const phoneOnly = renderToStaticMarkup(<OpenSearchNotice petName="Mia" url="/mission-control?mission=AUS-2026-0001" hasEmail={false} />);
    expect(phoneOnly).toContain('href="/mission-control?mission=AUS-2026-0001"');
    expect(phoneOnly).not.toMatch(/email|password|forgot-password/i);
    expect(phoneOnly).toContain('Reporting another pet now needs an account.');
    expect(phoneOnly).toContain('href="/register?callbackUrl=%2Freport%2Fnew"');
    expect(phoneOnly).toContain('Make an account to report another pet');
    // With no answer about an email, the notice says only what anyone can do.
    expect(renderToStaticMarkup(<OpenSearchNotice petName="Mia" url="/x" />)).not.toMatch(/forgot-password/);

    const withEmail = renderToStaticMarkup(<OpenSearchNotice petName="Mia" url="/mission-control?mission=AUS-2026-0001" hasEmail />);
    expect(withEmail).toContain('Sign in to report another pet');
    expect(withEmail).toContain('href="/forgot-password"');
    expect(withEmail).toContain('Set one with your email');
    expect(wizard).toMatch(/<OpenSearchNotice petName=\{openSearch\.petName\} url=\{openSearch\.url\} hasEmail=\{openSearch\.hasEmail === true\} \/>/);
  });

  test('the same searches count as at Post: closed, found, past its date or only opened from a link do not', async () => {
    for (const row of [{ status: 'REUNITED' }, { reportType: 'FOUND' }, { expiresAt: new Date(Date.now() - 1000) }]) {
      prisma.case.findMany.mockResolvedValue([{ ...OPEN, ...row }]);
      expect((await (await ask(made)).json()).open).toBeNull();
    }
    // The owner's link sets the key but never "made here", so a link someone was sent does not stop them reporting.
    prisma.case.findMany.mockResolvedValue([OPEN]);
    expect((await (await ask(`rp_owner_case-1=${mine.key}`)).json()).open).toBeNull();
    expect(await openSearchesMadeHere(new Request('http://localhost/', { headers: { cookie: made } }))).toHaveLength(1);
  });

  test('a wrong key, no key, or someone signed in is told nothing', async () => {
    expect((await (await ask(`rp_owner_case-1=${mintOwnerKey().key}; rp_made_case-1=1`)).json()).open).toBeNull();
    expect((await (await ask('')).json()).open).toBeNull();
    expect(prisma.case.findMany).toHaveBeenCalledTimes(1);
    getServerSession.mockResolvedValue({ user: { id: 'u1' } });
    expect((await (await ask(made)).json()).open).toBeNull();
  });

  test('the form asks before its first question and shows the notice instead of the questions', () => {
    expect(wizard).toMatch(/fetch\('\/api\/owner\/open-search'/);
    // The first step waits for the answer.
    expect(wizard).toMatch(/openSearch === undefined\) return;\s*setStepId/);
    expect(wizard).toMatch(/if \(openSearch && !isLoggedIn\)[\s\S]*?<OpenSearchNotice/);
    const notice = read('components/report/OpenSearchNotice.js');
    expect(notice).toMatch(/You already have a search open for \{name\}/);
    // A guest's account has no password yet: for one who gave an email, the way to set one is there, and the way out.
    expect(notice).toMatch(/href="\/forgot-password"/);
    expect(notice).toMatch(/href="\/"/);
  });
});

describe('the review flyer sets a long name the way the printed sheet does', () => {
  const LONG = 'Senor Bigotes de la Casa Grande';

  test('the whole name is there, on up to two lines, never cut to one', () => {
    const html = renderToStaticMarkup(<FlyerPreview species="CAT" petName={LONG} />);
    expect(html).toContain(`${LONG}, a cat`);
    expect(html).not.toMatch(/white-space:\s*nowrap/);
    expect(html).toMatch(/-webkit-line-clamp:\s*2/);
  });

  test('it shrinks by the printed rule: 26pt down to 14pt to fit the box beside LOST', () => {
    const flyer = read('lib/cascade/render/flyers/Flyer.jsx');
    // The printed sheet's own numbers, so the preview is told if they change.
    expect(flyer).toMatch(new RegExp(`CLAMP\\(2\\), \\.\\.\\.NAME\\(fitInter\\(data\\.coverLine, plan\\.nameW, ${NAME_PT.base} \\* k, ${NAME_PT.min} \\* k\\)\\)`));
    const short = fitNameLine('Max, a dog');
    expect(short.scale).toBe(1);
    const long = fitNameLine(`${LONG}, a cat`);
    expect(long.scale).toBeCloseTo(NAME_PT.min / NAME_PT.base, 5);
    // The box in the line's own ems is the printed box at the printed size.
    expect(long.boxEm * NAME_PT.min).toBeGreaterThan(150);
    expect(fitInter(`${LONG}, a cat`, long.boxEm * NAME_PT.min, NAME_PT.base, NAME_PT.min)).toBe(NAME_PT.min);
  });

  test('the line names the breed when the report has one, and never "Unknown"', () => {
    expect(coverLine({ petName: 'Milo', breed: 'Tabby', word: 'cat' })).toBe('Milo, a tabby');
    expect(coverLine({ petName: 'Rex', breed: 'English Setter', word: 'dog' })).toBe('Rex, an english setter');
    expect(coverLine({ petName: 'Mia', breed: 'Unknown', word: 'cat' })).toBe('Mia, a cat');
    expect(coverLine({ petName: '', breed: '', word: 'dog' })).toBe('A dog');
    expect(wizard).toMatch(/petName,\s*breed,\s*photoUrl/);
  });
});

describe("the found form's description has a limit", () => {
  test('typing or pasting stops at the limit, and the count shows near it', () => {
    expect(MARKS_MAX).toBe(500);
    const near = renderToStaticMarkup(<TagDetailsStep species="dog" value={{ marks: 'x'.repeat(450) }} onChange={() => {}} />);
    expect(near).toContain(`maxLength="${MARKS_MAX}"`);
    expect(near).toContain(`450 of ${MARKS_MAX} letters`);
    const short = renderToStaticMarkup(<TagDetailsStep species="dog" value={{ marks: 'Red collar' }} onChange={() => {}} />);
    expect(short).not.toContain('letters');
  });
});
