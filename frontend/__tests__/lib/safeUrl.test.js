/**
 * A web address that is safe to put in a link (app/lib/safeUrl.js).
 *
 * A shelter's website is shown as a link in the directory, on its page
 * and in the admin list. Stored as sent, an address that starts
 * `javascript:` would run in this site's own page when opened.
 */
import { safeWebUrl, WEB_URL_MAX } from '@/app/lib/safeUrl';

test('an http or https address is kept, written out by the parser', () => {
  expect(safeWebUrl('https://austinanimalcenter.org/adopt?x=1')).toBe('https://austinanimalcenter.org/adopt?x=1');
  expect(safeWebUrl('  http://example.org  ')).toBe('http://example.org/');
});

test.each([
  ['javascript:alert(document.cookie)'],
  ['JaVaScRiPt:alert(1)'],
  [' javascript:alert(1)'],
  ['data:text/html,<script>alert(1)</script>'],
  ['vbscript:msgbox(1)'],
  ['file:///etc/passwd'],
  ['mailto:someone@example.com'],
  ['//example.org'],
  ['example.org'],
  ['/shelters'],
  [''],
  ['   '],
])('%p is no address', (value) => {
  expect(safeWebUrl(value)).toBeNull();
});

test('a character that browsers drop from the front of an address does not get one past', () => {
  expect(safeWebUrl(`java${String.fromCharCode(9)}script:alert(1)`)).toBeNull();
  expect(safeWebUrl(`${String.fromCharCode(1)}javascript:alert(1)`)).toBeNull();
});

test('a name and a password in the address are refused', () => {
  expect(safeWebUrl('https://austinanimalcenter.org@evil.example/')).toBeNull();
  expect(safeWebUrl('https://user:pass@example.org/')).toBeNull();
});

test('anything that is not text, or is too long, is no address', () => {
  for (const value of [null, undefined, 42, {}, [], { href: 'https://example.org' }, true]) expect(safeWebUrl(value)).toBeNull();
  expect(safeWebUrl(`https://example.org/${'a'.repeat(WEB_URL_MAX)}`)).toBeNull();
});
