/**
 * GET /p/:code: the short link printed on the flyers (app/lib/caseShortLink.js)
 * sends a stranger who typed reunitepets.org/p/HF27J2 to the case page.
 */

const mockPrisma = { case: { findMany: jest.fn() } };
jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: mockPrisma }));

const { GET } = require('@/app/p/[code]/route');
const { caseShortCode, caseShortLabel, caseShortUrl, isShortCode } = require('@/app/lib/caseShortLink');

const get = (code) => GET(new Request(`http://localhost/p/${code}`), { params: Promise.resolve({ code }) });

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.case.findMany.mockResolvedValue([{ caseNumber: 'MUN-2026-HF27J2', resolvedAt: null }]);
});

test('the short code is the case number suffix, and the label is what a person types', () => {
  expect(caseShortCode('MUN-2026-HF27J2')).toBe('HF27J2');
  expect(caseShortCode('AUS-2026-0001')).toBe('0001');
  expect(caseShortCode('legacy')).toBe('LEGACY');
  expect(caseShortLabel('MUN-2026-HF27J2')).toBe('reunitepets.org/p/HF27J2');
  expect(caseShortUrl('MUN-2026-HF27J2')).toBe('https://www.reunitepets.org/p/HF27J2');
  expect(isShortCode('hf27j2')).toBe(true);
  expect(isShortCode('HF27J2; drop')).toBe(false);
  expect(isShortCode('')).toBe(false);
});

test('a typed code, in any case, lands on the case page', async () => {
  const res = await get('hf27j2');
  expect(res.status).toBe(302);
  expect(res.headers.get('location')).toBe('https://www.reunitepets.org/cases/MUN-2026-HF27J2');
  expect(mockPrisma.case.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { OR: [{ caseNumber: { endsWith: '-HF27J2' } }, { caseNumber: 'HF27J2' }] } })
  );
});

test('two cases with one suffix: the open case wins, then the newest', async () => {
  mockPrisma.case.findMany.mockResolvedValue([
    { caseNumber: 'NEW-2027-HF27J2', resolvedAt: new Date() },
    { caseNumber: 'OLD-2026-HF27J2', resolvedAt: null },
  ]);
  expect((await get('HF27J2')).headers.get('location')).toMatch(/\/cases\/OLD-2026-HF27J2$/);
  mockPrisma.case.findMany.mockResolvedValue([
    { caseNumber: 'NEW-2027-HF27J2', resolvedAt: new Date() },
    { caseNumber: 'OLD-2026-HF27J2', resolvedAt: new Date() },
  ]);
  expect((await get('HF27J2')).headers.get('location')).toMatch(/\/cases\/NEW-2027-HF27J2$/);
});

test('a code nobody has, a bad code, or a database error goes to the listing', async () => {
  mockPrisma.case.findMany.mockResolvedValue([]);
  expect((await get('ZZZZZZ')).headers.get('location')).toBe('https://www.reunitepets.org/lost-and-found');
  expect((await get('not%20a%20code')).headers.get('location')).toBe('https://www.reunitepets.org/lost-and-found');
  expect(mockPrisma.case.findMany).toHaveBeenCalledTimes(1);
  mockPrisma.case.findMany.mockRejectedValue(new Error('down'));
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect((await get('HF27J2')).headers.get('location')).toBe('https://www.reunitepets.org/lost-and-found');
  spy.mockRestore();
});
