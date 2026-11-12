/**
 * What a person typed into a search (a message, a note, their first name),
 * made fit to keep and to show as theirs.
 *
 * Taken out: what is not text at all. Control characters, the characters
 * that turn the direction of the writing around (they can make a line read
 * as something it is not), and the ones that draw as nothing and do no
 * work.
 *
 * Kept: the joiners and the direction marks (U+200C to U+200F). They draw
 * as nothing too, but they hold text together: a black cat is a cat, a
 * joiner and a black square, and without the joiner it is a cat and a
 * square. Persian needs the non-joiner inside words. So they stay in the
 * text, and only stop counting when the question is whether there is
 * anything to read (`hasText`).
 *
 * Kept as ASCII with escapes on purpose: these characters cannot be seen
 * in an editor.
 */

// eslint-disable-next-line no-control-regex
const NOT_TEXT = /[\u0000-\u0009\u000B-\u001F\u007F\u00AD\u115F\u1160\u180E\u200B\u2028-\u202E\u2060-\u2064\u2066-\u2069\u3164\uFEFF\uFFA0]/g;
const HOLDS_TEXT_TOGETHER = /[\u200C-\u200F]/g;

/** A first name as the search shows it: one word, and not a paragraph. A helper types their own. */
export const NAME_MAX = 30;

/**
 * How long an update may be (what the owner tells everyone helping:
 * /api/missions/[missionId]/notes). It is shown on the pet's page and on
 * every helper's card, and the boxes it is typed in stop at 400 and 500:
 * this is the server's own limit, for a request that did not come from a box.
 */
export const UPDATE_MAX = 1000;

/** `text` without what is not text. A tab becomes a space, so two words do not run together. Line breaks are kept. */
export function onlyText(text) {
  return String(text ?? '')
    .replace(/\t/g, ' ')
    .replace(NOT_TEXT, '');
}

/** Whether there is anything in it to read. */
export function hasText(text) {
  return Boolean(String(text ?? '').replace(HOLDS_TEXT_TOGETHER, '').trim());
}

/** At most `max` characters, never half of one. */
export function cut(text, max) {
  const s = String(text ?? '');
  return s.length <= max ? s : Array.from(s).slice(0, max).join('');
}

/** The first word of what was typed, as a name: at most NAME_MAX characters, or nothing where there is nothing to read. */
export function firstWord(text) {
  const word = cut(onlyText(text).trim().split(/\s+/)[0] || '', NAME_MAX);
  return hasText(word) ? word : '';
}
