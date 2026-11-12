/**
 * What a person typed into a search, made fit to keep and to show as
 * theirs (app/lib/searchText.js).
 *
 * The first version of this took out every character that draws as
 * nothing, and with them the joiners. On a site for lost pets that turned
 * a black cat (a cat, a joiner, a black square) into a cat and a square.
 * So what holds text together is kept, and a message made of nothing else
 * is still blank.
 *
 * Every character here is made from its number, so the file can be read.
 */
import { onlyText, hasText, cut, firstWord, NAME_MAX } from '@/app/lib/searchText';
import { cleanWord, WORD_MAX } from '@/app/lib/searchTalk';

const ch = (...codes) => String.fromCodePoint(...codes);
const JOINER = ch(0x200d);
const NON_JOINER = ch(0x200c);
const BLACK_CAT = ch(0x1f408, 0x200d, 0x2b1b);
const SERVICE_DOG = ch(0x1f415, 0x200d, 0x1f9ba);

describe('what holds text together is kept', () => {
  test('a black cat stays a black cat, in a message and in a name', () => {
    expect(cleanWord(`I saw a ${BLACK_CAT} on Elm`)).toBe(`I saw a ${BLACK_CAT} on Elm`);
    expect(cleanWord(`${SERVICE_DOG} with me`)).toBe(`${SERVICE_DOG} with me`);
    expect(firstWord(`Dana${BLACK_CAT} Reyes`)).toBe(`Dana${BLACK_CAT}`);
  });

  test('the non-joiner inside a word is kept, and so are the direction marks', () => {
    const word = `${ch(0x0645, 0x06cc)}${NON_JOINER}${ch(0x062e, 0x0648, 0x0627, 0x0647, 0x0645)}`;
    expect(cleanWord(word)).toBe(word);
    expect(firstWord(word)).toBe(word);
    const marked = `abc${ch(0x200e)}!${ch(0x200f)}`;
    expect(cleanWord(marked)).toBe(marked);
  });

  test('a narrow space between words is a space, not nothing', () => {
    const said = `Bonjour${ch(0x202f)}!`;
    expect(cleanWord(said)).toBe(said);
  });
});

describe('what is not text is taken out', () => {
  test('control characters, and the characters that turn the writing around', () => {
    const turned = `a${ch(0)}b${ch(0x202e)}c${ch(0x202a)}d${ch(0x2066)}e${ch(0x2069)}f`;
    expect(onlyText(turned)).toBe('abcdef');
    expect(cleanWord(turned)).toBe('abcdef');
  });

  test('a carriage return goes and the line break stays', () => {
    expect(cleanWord(`one${ch(13)}${ch(10)}two`)).toBe(`one${ch(10)}two`);
  });

  test('a tab is a space', () => {
    expect(onlyText(`Check${ch(9)}the alley`)).toBe('Check the alley');
  });
});

describe('whether there is anything to read', () => {
  test('a message made only of joiners and marks is blank', () => {
    expect(hasText(`${JOINER}${NON_JOINER}${ch(0x200e)}${ch(0x200f)}`)).toBe(false);
    expect(cleanWord(`${JOINER}${JOINER} ${NON_JOINER}`)).toBe('');
    expect(cleanWord(`${ch(0x200b)}${JOINER}${ch(0x3164)}`)).toBe('');
  });

  test('and one with a single thing to read is not', () => {
    expect(hasText(`${JOINER}x`)).toBe(true);
    expect(hasText('  ')).toBe(false);
    expect(hasText(null)).toBe(false);
  });
});

describe('cut to length', () => {
  test('never leaves half a character', () => {
    const cats = ch(0x1f408).repeat(WORD_MAX + 5);
    const kept = cleanWord(cats);
    expect(Array.from(kept)).toHaveLength(WORD_MAX);
    // Every piece is a whole cat: no lone half at the end.
    expect(Array.from(kept).every((c) => c === ch(0x1f408))).toBe(true);
    expect(cut('abcdef', 3)).toBe('abc');
    expect(cut('abc', 3)).toBe('abc');
    expect(cut(null, 3)).toBe('');
  });

  test('ordinary text is cut where it always was', () => {
    expect(cleanWord('x'.repeat(900))).toHaveLength(WORD_MAX);
  });
});

describe('a first name', () => {
  test('is the first word of what was typed, and not a paragraph', () => {
    expect(firstWord('  Dana Reyes ')).toBe('Dana');
    expect(firstWord('x'.repeat(200))).toHaveLength(NAME_MAX);
    expect(firstWord(null)).toBe('');
    expect(firstWord('')).toBe('');
  });

  test('a name that draws as nothing is no name, so the screen says "A helper" and never shows a blank', () => {
    // The filler that draws as an empty box of nothing, a zero-width space, and joiners alone.
    expect(firstWord(ch(0x3164))).toBe('');
    expect(firstWord(`${ch(0x200b)}${ch(0x200b)}`)).toBe('');
    expect(firstWord(`${JOINER}${JOINER}`)).toBe('');
    expect(firstWord(`${ch(0x3164)}Dana`)).toBe('Dana');
  });

  test('a name cannot turn the line it sits in around', () => {
    expect(firstWord(`${ch(0x202e)}anaD`)).toBe('anaD');
  });
});
