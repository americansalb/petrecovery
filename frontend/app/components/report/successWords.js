/**
 * What the page after posting says happened, built only from what the
 * create routes say did happen (their `told`, `assignedSquad` and
 * `matchesNotified`). Pure, so the claims are tested without a browser
 * (__tests__/components/success-words.test.js).
 *
 * Each line is a list of parts: a string, or { strong } for the address or
 * number, which the screen shows in bold. A send the route does not know
 * went is never said to have gone: the screen used to say "We texted this
 * link" when the text had failed, and "Sent to Mexico City Pet Rescue,
 * which covers the spot" when that force had been set up a second before
 * with the owner as its only member.
 */

const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);

/** The line about the link to the report, for a lost report. Null when there is nothing true to say. */
export function lostLinkLine({ contactEmail, contactPhone, phoneLabel, accountCreated = false, isLoggedIn = false, told, name }) {
  if (!contactEmail && contactPhone) {
    const phone = { strong: phoneLabel || contactPhone };
    const sent = told?.text;
    if (sent === 'sent') return ['We texted ', phone, ` the link that runs ${name}'s search. When someone reports seeing ${name}, we text you there.`];
    if (sent === 'sending') return ['We are texting the link to ', phone, '.'];
    if (sent === 'failed') return ['We could not text ', phone, '. Copy the link below and keep it.'];
    return ['Copy the link below and keep it.'];
  }
  if (!contactEmail) return null;
  const email = { strong: contactEmail };
  if (accountCreated) {
    // A password chosen here signs in once the address is confirmed, like every new account.
    return ['Confirm your email from the message we sent to ', email, ', then sign in with your password. Sightings are emailed there.'];
  }
  if (!isLoggedIn) {
    const sent = told?.email;
    if (sent === 'sent') return ['We emailed this link to ', email, '. Sightings are emailed there too.'];
    if (sent === 'failed') return ['We could not email the link to ', email, '. Copy it below and keep it.'];
    return ['We are emailing this link to ', email, '. Sightings are emailed there too.'];
  }
  return ['Sightings are emailed to ', email, '.'];
}

/**
 * The line about Rescue Forces, for a lost report. `assignedSquad` is the
 * create route's: { id, name, setUpNow, membersAlerted, membersPushed }.
 */
export function lostForceLine({ assignedSquad, squadsNotified = 0, name }) {
  const force = assignedSquad;
  if (!force?.name) {
    return 'No Rescue Force covers the spot yet. The report is on the Lost and Found board.';
  }
  const others = Math.max(0, squadsNotified - 1);
  const alerted = Number.isFinite(force.membersAlerted) ? force.membersAlerted : null;
  const pushed = Number.isFinite(force.membersPushed) ? force.membersPushed : 0;
  const members =
    alerted === null
      ? ''
      : alerted > 0
        ? ` ${alerted} ${plural(alerted, 'member was', 'members were')} alerted in the app${pushed > 0 ? `, ${pushed} of them on their phone` : ''}.`
        : '';

  if (force.setUpNow) {
    const nearby = others > 0 ? ` ${others} Rescue ${plural(others, 'Force')} nearby got the report too.` : '';
    return `No Rescue Force covered this spot yet, so ${force.name} was started for it, with you as its first member.${nearby}${members}`;
  }
  const sentTo = others > 0
    ? `Sent to ${force.name} and ${others} other Rescue ${plural(others, 'Force')} near the spot where ${name} was last seen.`
    : `Sent to ${force.name}, which covers the spot where ${name} was last seen.`;
  const none = alerted === 0 ? ' It has no other members to alert yet.' : '';
  return `${sentTo}${members}${none}`;
}

/** The line about neighbors who watch the area, or null. */
export function lostNeighborsLine({ told }) {
  const n = told?.neighbors || 0;
  return n > 0 ? `${n} ${plural(n, 'neighbor who watches', 'neighbors who watch')} for lost pets near the spot ${plural(n, 'gets', 'get')} an alert in the app.` : null;
}

/** The lines for a found report: the link, then the owners told. */
export function foundLines({ contactEmail, contactPhone, phoneLabel, told, matchesNotified = 0, word = 'pet' }) {
  const out = [];
  if (told?.email === 'sent' && contactEmail) out.push(['We emailed the link to ', { strong: contactEmail }, '.']);
  else if (told?.email === 'failed' && contactEmail) out.push(['We could not email the link to ', { strong: contactEmail }, '. Copy it above and keep it.']);
  else if (told?.text === 'sent' && contactPhone) out.push(['We texted the link to ', { strong: phoneLabel || contactPhone }, '.']);
  else if (told?.text === 'failed' && contactPhone) out.push(['We could not text ', { strong: phoneLabel || contactPhone }, '. Copy the link above and keep it.']);
  if (matchesNotified > 0) {
    out.push([
      matchesNotified === 1
        ? `We sent the owner of a lost ${word} that looks like this one a link to your report.`
        : `We sent the owners of ${matchesNotified} lost ${word}s that look like this one a link to your report.`,
    ]);
  }
  return out;
}

/** Where a message from an owner reaches the finder, or null. */
export function finderReplyNote({ contactEmail, contactPhone, phoneLabel }) {
  const to = contactEmail || phoneLabel || contactPhone;
  return to ? `If an owner writes to you through the site, the message comes to ${to}.` : null;
}

/** What the kit's tiles say while they are drawn, and when a drawing did not come out. */
export const KIT_WORDS = {
  flyerDrawing: 'Drawing the flyer, about a minute',
  flyerRedrawing: 'Drawing the flyer again, about a minute',
  flyerMissing: 'The flyer did not draw.',
  shareDrawing: 'Drawing the share image',
  shareMissing: 'The share image did not draw.',
  sheltersFinding: 'Finding the shelters near the spot',
  sheltersMissing: 'No shelters came up for this spot. Call the animal shelter for the town.',
  tryAgain: 'Draw it again',
  stillMissing: 'It did not draw again. Try again in ten minutes.',
};
