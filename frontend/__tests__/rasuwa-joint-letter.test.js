/**
 * /rasuwa/letter's document handling (jointLetter.js): the plain-text
 * export of the live families' letter into renderable paragraphs. The
 * fetch itself is exercised against the real document after deploy; a
 * failure there falls back to linking the document directly.
 */

const { normalizeJointLetterText } = require('@/app/rasuwa/jointLetter');

describe('normalizeJointLetterText', () => {
  test('splits on blank lines, folds CRLF, strips the BOM', () => {
    const raw = '﻿August 31, 2026\r\n\r\nDear Mr. Secretary:\r\n\r\nWe are Americans.\nWe are asking now.\r\n';
    expect(normalizeJointLetterText(raw)).toEqual([
      'August 31, 2026',
      'Dear Mr. Secretary:',
      'We are Americans.\nWe are asking now.',
    ]);
  });

  test('empty or blank input is null, never an empty render', () => {
    expect(normalizeJointLetterText('')).toBeNull();
    expect(normalizeJointLetterText('  \n\n  ')).toBeNull();
    expect(normalizeJointLetterText(null)).toBeNull();
  });
});
