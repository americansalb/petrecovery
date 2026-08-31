/**
 * Letter content for the /rasuwa tool: templates, delivery links, and the
 * facts the letters cite. Everything factual is sourced from the families'
 * August 29, 2026 letter to the U.S. Secretary of State; FACTS_DATE is
 * stamped on every generated letter so staleness is visible.
 *
 * Organizers update THIS FILE (and missing-people.json) as the situation
 * changes; the UI in RasuwaLetterTool.js reads from here and never
 * hardcodes copy about the flood.
 */

export const FACTS_DATE = 'August 31, 2026';

/**
 * Signatures on the joint letter AS SENT on August 29. The generated
 * letters cite this number because they quote that letter, a dated
 * document an office can verify; it does not change as the roster
 * grows. The landing pages show the LIVE roster count instead, served
 * by /api/rasuwa/roster-count with this as the floor.
 */
export const SIGNERS_AUG29 = 1189;


/**
 * The coalition's roster form (the Google Form web app that was the
 * rescueourfamily.org front page). Paste its script.google.com or
 * forms.gle URL here and the tool links it from the roster step;
 * leave empty to hide the link.
 */
export const ROSTER_FORM_URL =
  'https://script.google.com/macros/s/AKfycbxO42Y7iQE8WURRQLx2IN9UwEpbBA7GDQrqUNkA2zyRcbROgdCn6So1ljXoPsXXWlny/exec';

/**
 * Where the live signer count comes from: a URL that answers with the
 * current roster size, either as a bare number ("2345") or as JSON
 * ({"count": 2345}). Defaults to asking the roster web app with
 * ?count=1; until the organizers add the handler below to their Apps
 * Script doGet, that returns the form's HTML, the parser rejects it,
 * and the pages show "More than 1,189" from the floor. Paste into the
 * script, redeploy the web app, and the count goes live with no site
 * deploy:
 *
 *   if (e && e.parameter && e.parameter.count) {
 *     const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
 *     return ContentService
 *       .createTextOutput(JSON.stringify({ count: sheet.getLastRow() - 1 }))
 *       .setMimeType(ContentService.MimeType.JSON);
 *   }
 */
export const ROSTER_COUNT_URL = ROSTER_FORM_URL ? `${ROSTER_FORM_URL}?count=1` : '';

/** Official fallback links when the bundled directory is not enough. */
export const US_LINKS = {
  houseFinder: 'https://www.house.gov/representatives/find-your-representative',
  senateContacts: 'https://www.senate.gov/senators/senators-contact.htm',
  embassyKathmandu: 'https://np.usembassy.gov',
  stateDept: 'https://travel.state.gov',
};

/**
 * Canada gets a first-class path (many of the missing are Canadian
 * citizens): MPs do consular casework through Global Affairs Canada,
 * every MP has a public email, and mail to the House of Commons needs
 * no postage from within Canada. The emergency line and address are
 * long-standing public constants.
 */
export const CANADA_LINKS = {
  findMp: { label: 'Find your Member of Parliament (ourcommons.ca)', url: 'https://www.ourcommons.ca/members/en' },
  consular: { label: 'Global Affairs Canada emergency assistance', url: 'https://travel.gc.ca/assistance/emergency-assistance' },
  globalAffairsPhone: '+1-613-996-8885',
  globalAffairsEmail: 'sos@international.gc.ca',
  freePost: 'House of Commons, Ottawa, Ontario, K1A 0A6 (no postage needed when mailing from Canada)',
};

/**
 * Guidance for families outside the United States. Official domains only;
 * no phone numbers here because we cannot keep them verified.
 */
export const COUNTRY_GUIDES = [
  {
    country: 'Australia',
    findRep: { label: 'Find your federal MP or senator (aph.gov.au)', url: 'https://www.aph.gov.au/Senators_and_Members' },
    consular: { label: 'DFAT consular services (Smartraveller)', url: 'https://www.smartraveller.gov.au/consular-services' },
  },
  {
    country: 'United Kingdom',
    findRep: { label: 'Find your MP (parliament.uk)', url: 'https://members.parliament.uk/FindYourMP' },
    consular: { label: 'Foreign, Commonwealth and Development Office', url: 'https://www.gov.uk/government/organisations/foreign-commonwealth-development-office' },
  },
  {
    country: 'Singapore',
    findRep: { label: 'Members of Parliament (parliament.gov.sg)', url: 'https://www.parliament.gov.sg/mps/list-of-current-mps' },
    consular: { label: 'Ministry of Foreign Affairs Singapore', url: 'https://www.mfa.gov.sg' },
  },
  {
    country: 'India',
    findRep: { label: 'Members of the Lok Sabha (sansad.in)', url: 'https://sansad.in/ls/members' },
    consular: { label: 'Ministry of External Affairs', url: 'https://www.mea.gov.in' },
  },
  {
    country: 'France',
    findRep: { label: 'Find your deputy (assemblee-nationale.fr)', url: 'https://www.assemblee-nationale.fr/dyn/vos-deputes' },
    consular: { label: 'Ministere de l\'Europe et des Affaires etrangeres', url: 'https://www.diplomatie.gouv.fr' },
  },
  {
    country: 'South Africa',
    findRep: { label: 'Parliament of South Africa', url: 'https://www.parliament.gov.za' },
    consular: { label: 'Department of International Relations and Cooperation', url: 'https://www.dirco.gov.za' },
  },
  {
    country: 'Another country',
    findRep: null,
    consular: null,
    note: 'Write to your national parliament member and your foreign ministry, and ask your embassy or consulate responsible for Nepal to open a case.',
  },
];

/**
 * The guide for a typed country name: matched case-insensitively so
 * "france" finds France, with the generic last entry for every country
 * the list does not cover. The country fields are free text (founder
 * feedback, 2026-08-31: a pick-list without your country reads as a
 * form you cannot fill in), so this must accept anything.
 */
export function findCountryGuide(value) {
  const wanted = String(value || '').trim().toLowerCase();
  return (
    COUNTRY_GUIDES.find((g) => g.country.toLowerCase() === wanted) ||
    COUNTRY_GUIDES[COUNTRY_GUIDES.length - 1]
  );
}

// No personal contact details on the site (founder instruction,
// 2026-08-31: the coordinator's own email and phone came down). List
// corrections and new entries go through the family form on
// /rasuwa/form; the live letter page shows the result.

/** One-paragraph condensation of the joint letter's seven requests. */
const SEVEN_ASKS =
  'high-altitude military helicopters offered to Nepal, as the United States provided after the 2015 earthquake; ' +
  'search and rescue drones, ground radar that detects breathing under debris, equipment to locate mobile phones, and temporary cellular coverage over the valley; ' +
  'satellite imagery of the corridor from Rasuwagadhi to Trishuli Bazar and Devighat, shared with the Nepal Army officers coordinating the search; ' +
  'a U.S. urban search and rescue team staged in Kathmandu; ' +
  'a named consular liaison and a daily update for each family, with officers at the Kathmandu hospitals and at the forward base in Rasuwa; ' +
  'consular coordination with China at the Gyirong border and with the other governments whose people were in the same tour groups; ' +
  'and funding on the scale of the disaster.';

const FLOOD_SENTENCE =
  'the flash flood that came down the Bhotekoshi and Trishuli valleys in Nepal\'s Rasuwa district on the morning of Wednesday, August 26';

// Figures sourced 2026-08-31: the State Department's August 30 briefing
// (about 85 Americans unaccounted for, nine evacuated), wire reporting
// of the combined toll, and the families' August 31 letter (rescue
// totals, the barrier lakes, Nepal's Foreign Ministry stance, the UK
// pledge). Organizers: update these two paragraphs and FACTS_DATE
// together whenever the situation moves.
const SITUATION_US =
  'The State Department said on August 30 that approximately 85 Americans remain unaccounted for and that nine have been evacuated. ' +
  'Nepali crews have rescued more than 3,700 people, but helicopters still cannot land in parts of the upper valley, rescue work has been interrupted by overflowing barrier lakes, and authorities report a combined death toll above 900 with thousands still listed as missing on both sides of the border. ' +
  'Nepal\'s Foreign Ministry has said it does not need foreign search and rescue teams at this time but is open to targeted technical support. ' +
  `As of ${FACTS_DATE}, the announced United States response consisted of monitoring, a hotline, $500,000 in relief supplies, and one disaster response adviser, while the United Kingdom has pledged 5 million pounds and is sending emergency responders and consular staff to the region.`;

const SITUATION_INTL =
  'Authorities report a combined death toll above 900, with thousands still listed as missing on both sides of the Nepal-China border. ' +
  'The missing include pilgrims, guides, and workers from Nepal, India, the United States, and more than two dozen other countries. ' +
  'Nepali crews have rescued more than 3,700 people, but helicopters still cannot land in parts of the upper valley, and Nepal\'s Foreign Ministry has said it does not need foreign search and rescue teams at this time but is open to targeted technical support.';

/**
 * The live joint-letter document the coordinating family keeps updated
 * (the letter to the Secretary of State plus the list of the missing
 * and their signers). /rasuwa/letter mirrors it on the family domain,
 * refreshing every few minutes, and /letter redirects there on every
 * host; the generated letters cite that stable address so an office
 * can verify the campaign at its source.
 */
export const JOINT_LETTER_DOC_ID = '19p4njE4Zt6cSOlg-F8oG2pn4d_tV7xiIjbX7RfI1dio';
export const JOINT_LETTER_DOC_URL = `https://docs.google.com/document/d/${JOINT_LETTER_DOC_ID}/edit`;
export const JOINT_LETTER_PAGE = 'rescueourfamily.org/letter';
const LETTER_POINTER = `The letter and the list of the missing: ${JOINT_LETTER_PAGE}`;

const JOINT_LETTER_SENTENCE =
  `On August 29, ${SIGNERS_AUG29.toLocaleString('en-US')} family members and friends of 57 missing people, my family among them, wrote to the United States Secretary of State asking for seven actions: ${SEVEN_ASKS}`;

/**
 * The joint-letter sentence, with the live signature count when the
 * wizard has one (founder direction, 2026-08-31: the letters must not
 * read as frozen at the August 29 figure). The dated 1,189 stays as
 * the verifiable delivery fact; the live number rides after it, only
 * when it is genuinely larger.
 */
export function jointLetterSentence(signers) {
  const live = Number(signers);
  const growth =
    Number.isFinite(live) && live > SIGNERS_AUG29
      ? ` The letter has kept gathering signatures since; as of today more than ${live.toLocaleString('en-US')} family members and friends have signed.`
      : '';
  return `${JOINT_LETTER_SENTENCE}${growth}`;
}

/**
 * The consent counter (founder direction, 2026-08-31): offices deflect
 * families with "Nepal is not letting foreign teams in." Consent is a
 * diplomatic product, not weather, so every letter asks for the offer
 * to be made formally and for Nepal's answer to be on the record, and
 * the call script carries a prepared comeback. The 2015 reference is
 * the same one the joint letter itself uses.
 */
/**
 * Bumped whenever the generated letter wording changes in a way every
 * letter must carry (v2: the consent paragraph). Drafts store the
 * version they were edited under; restoring hand edits from an older
 * template rebuilds the letters and says so, instead of silently
 * sending the old wording (review finding on PR #223).
 */
export const LETTER_TEMPLATE_VERSION = 2;

const ACCESS_PARAGRAPH =
  'If any of this is said to be waiting on the Government of Nepal\'s consent, obtaining that consent is part of what I am asking for. ' +
  'Nepal\'s Foreign Ministry has said it is open to targeted technical support, and Nepal accepted American military helicopters and international rescue teams after the 2015 earthquake. ' +
  'Press for each offer to be made formally, in writing, at a senior level; for the families to be told what was offered, to whom, and on what date; ' +
  'and if Nepal declines, for that refusal to be on the record.';

/** Rendered on the delivery step under the phone script, for every path. */
export const ACCESS_COMEBACK = {
  title: 'If they say "Nepal is not accepting foreign help"',
  ask: 'What did our government formally offer, to whom in Nepal\'s government, on what date, and what was Nepal\'s answer?',
  note:
    'A staffer repeating a general line cannot answer that. Ask them to find out and call you back. ' +
    'Nepal\'s Foreign Ministry has said it is open to targeted technical support, and Nepal accepted American military helicopters and international rescue teams after the 2015 earthquake. ' +
    'If a formal offer has been refused, the families should be told so, on the record.',
};

/** "[your street address]" style gap markers keep an incomplete letter obviously incomplete. */
const ph = (value, label) => (value && String(value).trim()) || `[${label}]`;

function longDate() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function personIntro(person) {
  const home = person.home && person.home.trim() ? `, of ${person.home.trim()}` : '';
  return `${ph(person.name, 'name of your missing family member')}${home}`;
}

function lastSeenSentence(person) {
  const name = ph(person.name, 'name');
  const place = ph(person.lastSeenPlace, 'last known location');
  const when = person.lastSeenWhen && person.lastSeenWhen.trim() ? ` on ${person.lastSeenWhen.trim()}` : '';
  const op = person.operator && person.operator.trim() ? `, traveling with ${person.operator.trim()}` : '';
  return `${name} was last seen at ${place}${when}${op}.`;
}

export function buildSubject({ writer, person, recipient }) {
  const name = ph(person.name, 'name');
  if (recipient && recipient.chamber === 'mp') {
    const riding = recipient.riding && recipient.riding.trim() ? recipient.riding.trim() : '[your riding]';
    return `Constituent in ${riding}: ${name}, missing in the Rasuwa flood in Nepal. Request for consular action.`;
  }
  if (writer.inUS) {
    const city = ph(writer.city, 'your city');
    const state = ph(writer.state, 'ST');
    return `Constituent in ${city}, ${state}: ${name}, missing in the Rasuwa flood in Nepal. Casework request.`;
  }
  return `${name}, missing in the Rasuwa flood in Nepal. Request for consular action.`;
}

export function recipientTitle(recipient) {
  if (recipient.chamber === 'mp') return 'MP';
  return recipient.chamber === 'sen' ? 'Senator' : 'Representative';
}

/**
 * Compound surnames the token rules below cannot infer. Keyed by
 * bioguide; review when the directory is refreshed for a new Congress.
 */
const SURNAME_OVERRIDES = {
  B001303: 'Blunt Rochester',
  W000797: 'Wasserman Schultz',
};

/** Surname particles that belong with the last token ("Van Hollen"). */
const SURNAME_PARTICLES = new Set(['Van', 'Vander', 'De', 'Del', 'Della', 'Der', 'La', 'Da', 'Ter', 'St.', 'Saint']);

export function recipientLastName(recipient) {
  const override = recipient.bioguide && SURNAME_OVERRIDES[recipient.bioguide];
  if (override) return override;
  const parts = recipient.name.trim().split(/\s+/);
  let i = parts.length - 1;
  // "Jr.", "III" style suffixes: take the token before them
  if (/^(Jr\.?|Sr\.?|II|III|IV)$/i.test(parts[i]) && i > 0) i--;
  let last = parts[i].replace(/,$/, '');
  while (i > 0 && SURNAME_PARTICLES.has(parts[i - 1].replace(/,$/, ''))) {
    i--;
    last = `${parts[i].replace(/,$/, '')} ${last}`;
  }
  return last;
}

export function recipientAddressLines(recipient) {
  if (recipient.chamber === 'mp') {
    const nm = recipient.name && recipient.name.trim() ? `${recipient.name.trim()}, M.P.` : "[your MP's name], M.P.";
    const riding = recipient.riding && recipient.riding.trim()
      ? `Member of Parliament for ${recipient.riding.trim()}`
      : 'Member of Parliament';
    return [nm, riding, 'House of Commons', 'Ottawa, Ontario K1A 0A6'];
  }
  if (recipient.chamber === 'sen') {
    return [`The Honorable ${recipient.name}`, 'United States Senate', 'Washington, DC 20510'];
  }
  return [`The Honorable ${recipient.name}`, 'United States House of Representatives', 'Washington, DC 20515'];
}

/**
 * The full letter body for one recipient.
 * recipient: a member from congress-directory.json, or { chamber: 'intl' }
 * for families writing outside the United States.
 */
export function buildLetterBody({ recipient, writer, person, signers }) {
  const name = ph(person.name, 'name');
  const relationship = ph(writer.relationship, 'relationship');
  const writerName = ph(writer.name, 'your name');
  const phone = ph(writer.phone, 'your phone number');
  const email = writer.email && writer.email.trim() ? ` and ${writer.email.trim()}` : '';
  const details = person.details && person.details.trim() ? `\n\n${person.details.trim()}` : '';
  const isUSPerson = person.country === 'United States';

  if (recipient.chamber === 'mp') {
    const mpName = ph(recipient.name, "your MP's name");
    const riding = recipient.riding && recipient.riding.trim() ? recipient.riding.trim() : '[your riding]';
    const isCanadian = person.country === 'Canada';
    const personLine = isCanadian
      ? `one of the Canadians unaccounted for since ${FLOOD_SENTENCE}`
      : `a national of ${person.country || '[country]'} unaccounted for since ${FLOOD_SENTENCE}`;
    const askTwo = isCanadian
      ? `2. Ask Global Affairs Canada to open a case file for ${name} and give me a named consular contact with an update every day until ${name} is accounted for.`
      : `2. Ask Global Affairs Canada to open a case file for ${name} and to coordinate with the government of ${person.country || '[country]'} on the case.`;
    return (
      `${recipientAddressLines(recipient).join('\n')}\n\n` +
      `${longDate()}\n\n` +
      `Re: ${buildSubject({ writer, person, recipient })}\n\n` +
      `Dear ${mpName}:\n\n` +
      `I am your constituent in ${riding}. I am writing about my ${relationship}, ${personIntro(person)}, ${personLine}.\n\n` +
      `${lastSeenSentence(person)}${details}\n\n` +
      `${SITUATION_INTL} ${jointLetterSentence(signers)} ${LETTER_POINTER}.\n\n` +
      `I ask you to do three things:\n\n` +
      `1. Contact Global Affairs Canada's Emergency Watch and Response Centre today, ask what Canada has done for ${name} and for the other Canadians missing in Rasuwa, and press for the technical support the families requested: helicopters, search drones, ground radar, satellite imagery, and search teams.\n\n` +
      `${askTwo}\n\n` +
      `3. Press for consular coordination with Nepal and China on search access at the Gyirong border and on shared lists of the rescued and the recovered.\n\n` +
      `${ACCESS_PARAGRAPH}\n\n` +
      `I can be reached at ${phone}${email}. Time matters in a search. Please treat this as urgent.\n\n` +
      `Respectfully,\n\n` +
      `${writerName}\n` +
      `(Facts as of ${FACTS_DATE}.)`
    );
  }

  if (recipient.chamber === 'intl') {
    const country = person.country || '[country]';
    return (
      `${longDate()}\n\n` +
      `To: [name and office of your Member of Parliament or consular officer]\n\n` +
      `Re: ${buildSubject({ writer, person })}\n\n` +
      `Dear [name]:\n\n` +
      `I am writing about my ${relationship}, ${personIntro(person)}, who has been unaccounted for since ${FLOOD_SENTENCE}.\n\n` +
      `${lastSeenSentence(person)}${details}\n\n` +
      `${SITUATION_INTL} ${jointLetterSentence(signers)} ${LETTER_POINTER}.\n\n` +
      `I ask you to do three things:\n\n` +
      `1. Tell me what our government has done to date for ${name} and for the other nationals of ${country} missing in Rasuwa, and press for the same technical support the families requested: helicopters, search drones, ground radar, satellite imagery, and search teams.\n\n` +
      `2. Open a case file for ${name} and give me a named point of contact with a daily update.\n\n` +
      `3. Coordinate with Nepal and China on search access at the Gyirong border and on shared lists of the rescued and the recovered.\n\n` +
      `${ACCESS_PARAGRAPH}\n\n` +
      `I can be reached at ${phone}${email}. Time matters in a search. Please treat this as urgent.\n\n` +
      `Respectfully,\n\n` +
      `${writerName}\n` +
      `(Facts as of ${FACTS_DATE}.)`
    );
  }

  const title = recipientTitle(recipient);
  const lastName = recipientLastName(recipient);
  const street = ph(writer.street, 'your street address');
  const city = ph(writer.city, 'city');
  const state = ph(writer.state, 'state');
  const zip = ph(writer.zip, 'ZIP');

  const firstPara = isUSPerson
    ? `I am your constituent. I live at ${street}, ${city}, ${state} ${zip}. I am writing about my ${relationship}, ${personIntro(person)}, one of the Americans unaccounted for since ${FLOOD_SENTENCE}.`
    : `I am your constituent. I live at ${street}, ${city}, ${state} ${zip}. I am writing about my ${relationship}, ${personIntro(person)}, a national of ${person.country || '[country]'} unaccounted for since ${FLOOD_SENTENCE}. My family is in your district and we need your help.`;

  const askTwo = isUSPerson
    ? `2. Open a casework file for ${name}. Send me your office's privacy release form and I will return it signed the same day.`
    : `2. Open a congressional inquiry for ${name}, and ask the State Department to coordinate with the government of ${person.country || '[country]'} on the case.`;

  return (
    `${recipientAddressLines(recipient).join('\n')}\n\n` +
    `${longDate()}\n\n` +
    `Re: ${buildSubject({ writer, person })}\n\n` +
    `Dear ${title} ${lastName}:\n\n` +
    `${firstPara}\n\n` +
    `${lastSeenSentence(person)}${details}\n\n` +
    `${SITUATION_US}\n\n` +
    `${jointLetterSentence(signers)} ${LETTER_POINTER}.\n\n` +
    `I ask you to do three things:\n\n` +
    `1. Contact the State Department's Bureau of Consular Affairs today in support of the seven requests in the families' August 29 letter, and ask what the Department has done on each one.\n\n` +
    `${askTwo}\n\n` +
    `3. Have a caseworker give me a named point of contact and an update every day until ${name} is accounted for.\n\n` +
    `${ACCESS_PARAGRAPH}\n\n` +
    `I can be reached at ${phone}${email}. Time matters in a search. Please treat this as urgent.\n\n` +
    `Respectfully,\n\n` +
    `${writerName}\n` +
    `${street}\n` +
    `${city}, ${state} ${zip}\n` +
    `(Facts as of ${FACTS_DATE}.)`
  );
}

/** A 30 second script for calling the DC and district offices. */
export function buildPhoneScript({ recipient, writer, person }) {
  const name = ph(person.name, 'name');
  if (recipient && recipient.chamber === 'mp') {
    const riding = recipient.riding && recipient.riding.trim() ? ` in ${recipient.riding.trim()}` : '';
    return (
      `Hello, my name is ${ph(writer.name, 'your name')}. I am a constituent${riding}. ` +
      `My ${ph(writer.relationship, 'relationship')}, ${name}, is unaccounted for in the August 26 flood in Nepal's Rasuwa district. ` +
      `I am asking the MP to do two things: press Global Affairs Canada to act for the families of the missing, and ask Global Affairs to open a case file for ${name}. ` +
      `My number is ${ph(writer.phone, 'your phone number')}. Which staff member will handle this?`
    );
  }
  const title = recipient && recipient.chamber !== 'intl' ? `${recipientTitle(recipient)} ${recipientLastName(recipient)}` : 'your office';
  return (
    `Hello, my name is ${ph(writer.name, 'your name')}. I am a constituent in ${ph(writer.city, 'your city')}. ` +
    `My ${ph(writer.relationship, 'relationship')}, ${name}, is unaccounted for in the August 26 flood in Nepal's Rasuwa district. ` +
    `I am asking ${title} to do two things: press the State Department to act on the families' August 29 letter, and open a casework file for ${name}. ` +
    `Please send me the office's privacy release form today. ` +
    `My number is ${ph(writer.phone, 'your phone number')}. Which caseworker will handle this?`
  );
}

/**
 * Mailto content for sending the person's entry to the coordinating family,
 * so the consolidated roster and the letters stay in step.
 */
export function buildRosterShare({ writer, person }) {
  const name = ph(person.name, 'name');
  const subject = `Families' letter entry: ${name} (${ph(person.lastSeenPlace, 'last known location')})`;
  const body =
    `Missing person: ${name}\n` +
    `Nationality: ${person.country || ''}\n` +
    `Home: ${person.home || ''}\n` +
    `Last seen: ${person.lastSeenPlace || ''}${person.lastSeenWhen ? `, ${person.lastSeenWhen}` : ''}\n` +
    `Traveling with: ${person.operator || ''}\n` +
    (person.details && person.details.trim() ? `Details: ${person.details.trim()}\n` : '') +
    `\nSigned by: ${ph(writer.name, 'your name')} (${ph(writer.relationship, 'relationship')})\n` +
    `Phone: ${writer.phone || ''}\n` +
    `Email: ${writer.email || ''}\n\n` +
    `I consent to this entry and my contact information appearing in the families' letters to governments asking for rescue.\n`;
  return { subject, body };
}
