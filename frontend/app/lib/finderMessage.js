/**
 * A message to the person who found a pet, from someone who thinks it is
 * theirs.
 *
 * A finder gives an email or a phone number on the found report ("How can
 * the owner reach you?"). The found pet's page shows the phone when there
 * is one, and nothing at all when the finder chose "Email me", so an owner
 * told about a found cat that looks like theirs had no way to reach the
 * person holding it. Now the owner writes a short message on the site and
 * the site sends it on, by email or by text, whichever the finder gave.
 * The finder's address is never shown to the person writing. The person
 * writing adds an email or phone for the finder to write back to, or, when
 * they have a lost report of their own open, the finder is sent the link
 * to it; nothing else about them is passed on.
 *
 * The route: GET and POST /api/reports/[id]/message. The page:
 * /report/found/message?case=<case number>.
 */

import { isDeliverableEmail } from '@/app/lib/placeholderEmail';

// The same escaping as app/lib/email.js, kept here so the page can import this file without the mail senders.
const escapeHtml = (value) =>
  String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const MESSAGE_MAX = 600;
export const NAME_MAX = 60;

/** Where someone writes to the finder of a found report. */
export function messageFinderPath(caseNumber) {
  return `/report/found/message?case=${encodeURIComponent(caseNumber)}`;
}

const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** A phone number a person could have typed: 7 to 15 digits, with the usual marks around them. */
function phoneOf(value) {
  if (!/^[+\d\s().-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? value : null;
}

/**
 * Checks what was typed. Returns { error } in the words the page shows, or
 * { value: { message, name, replyTo } }. replyTo is { kind: 'email' |
 * 'phone', value } or null.
 */
export function checkFinderMessage(body = {}) {
  const message = String(body.message ?? '').replace(/\r\n/g, '\n').trim();
  if (!message) return { error: 'Write a message to the finder.' };
  if (message.length > MESSAGE_MAX) return { error: `Keep the message under ${MESSAGE_MAX} characters.` };
  const name = clean(body.name, NAME_MAX);
  const typed = clean(body.replyTo, 120);
  let replyTo = null;
  if (typed) {
    if (isDeliverableEmail(typed)) replyTo = { kind: 'email', value: typed.toLowerCase() };
    else if (phoneOf(typed)) replyTo = { kind: 'phone', value: typed };
    else return { error: 'That is not an email address or a phone number.' };
  }
  return { value: { message, name, replyTo } };
}

/**
 * How the site reaches the finder of a found case: { email } when the
 * report or the account has an address mail can reach, else { phone }
 * when there is a number, else null. Pure. `c` is the case with its
 * reporter's email and phone.
 */
export function finderReach(c) {
  if (!c) return null;
  const email = [c.ownerEmail, c.reporter?.email].find(isDeliverableEmail);
  if (email) return { email };
  const phone = [c.ownerPhone, c.reporter?.phone].map((p) => String(p || '').trim()).find((p) => phoneOf(p));
  return phone ? { phone } : null;
}

/** The kind of animal in a word: "cat", "dog", "pet". */
export function kindWord(species) {
  const word = String(species || '').toLowerCase();
  return ['dog', 'cat', 'bird', 'rabbit'].includes(word) ? word : 'pet';
}

/**
 * The words sent on. `fromReport` is { petName, url } when the person
 * writing has a lost report open; `replyTo` what they chose to share.
 */
function parts({ value, kind, fromReport }) {
  const who = value.name || 'Someone';
  const back = value.replyTo
    ? `${value.replyTo.kind === 'email' ? 'Write back to' : 'Call or text'} ${value.replyTo.value}.`
    : fromReport
      ? `They have not shared an email or phone. Their lost-pet report for ${fromReport.petName} is here, with any number they put on it: ${fromReport.url}`
      : '';
  const proof = `Before you hand the ${kind} over, ask them to show it is theirs: photos of it at home, a vet record or the microchip number. Nobody should ask you for money or a fee to get it back.`;
  return { who, back, proof };
}

/** The email to the finder: { subject, heading, bodyHtml }, for renderBrandedEmail. */
export function finderMessageEmail({ value, kind, fromReport = null }) {
  const { who, back, proof } = parts({ value, kind, fromReport });
  const subject = `A message about the ${kind} you found`;
  const quoted = escapeHtml(value.message).replace(/\n/g, '<br />');
  const backHtml = value.replyTo
    ? value.replyTo.kind === 'email'
      ? `Write back to <a href="mailto:${escapeHtml(value.replyTo.value)}" style="color:#0f172a; font-weight:600;">${escapeHtml(value.replyTo.value)}</a>.`
      : `Call or text <a href="tel:${escapeHtml(value.replyTo.value.replace(/[^\d+]/g, ''))}" style="color:#0f172a; font-weight:600;">${escapeHtml(value.replyTo.value)}</a>.`
    : escapeHtml(back);
  return {
    subject,
    heading: subject,
    bodyHtml: `
      <p>${escapeHtml(who)} wrote to you about the ${escapeHtml(kind)} you reported found:</p>
      <p style="margin:12px 0; padding:12px 14px; background:#f1f5f9; border-radius:8px;">${quoted}</p>
      ${backHtml ? `<p>${backHtml}</p>` : ''}
      <p style="color:#64748b; font-size:14px;">${escapeHtml(proof)}</p>
      <p style="color:#64748b; font-size:14px;">Your email and phone were not shown to them.</p>
    `,
  };
}

/** The text to the finder. */
export function finderMessageText({ value, kind, fromReport = null }) {
  const { who, back } = parts({ value, kind, fromReport });
  const short = value.message.length > 300 ? `${value.message.slice(0, 297)}...` : value.message;
  return `ReunitePets: ${who} wrote about the ${kind} you found: "${short}" ${back} Ask them to show it is theirs before you hand it over.`.replace(/\s+/g, ' ').trim();
}
