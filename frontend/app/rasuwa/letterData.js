/**
 * Letter content for the /rasuwa tool: templates, delivery links, and the
 * facts the letters cite. Everything factual is sourced from the families'
 * live joint letter to the U.S. Secretary of State (the document behind
 * rescueourfamily.org/letter); FACTS_DATE is stamped on every generated
 * letter so staleness is visible.
 *
 * Organizers update THIS FILE (and missing-people.json) as the situation
 * changes; the UI in RasuwaLetterTool.js reads from here and never
 * hardcodes copy about the flood.
 */

import missingPeople from './missing-people.json';
import { normalizePersonKey } from './team/teamLogic';

export const FACTS_DATE = 'September 2, 2026';

/**
 * The joint letter's own headline figures: how many people have signed
 * and how many missing people they signed for, as the live letter
 * showed them on FACTS_DATE. The letter is a living document, so the
 * generated letters and the landing pages treat LETTER_SIGNERS as a
 * floor ("More than 3,373"), which stays true as signatures keep
 * arriving; /api/rasuwa/roster-count replaces it with the live roster
 * count when the organizers' sheet answers.
 */
export const LETTER_SIGNERS = 3373;
export const LETTER_MISSING = 86;


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
 * and the pages show "More than 3,373" from the floor. Paste into the
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
 * Guidance for families outside the United States, one entry per
 * nationality on the families' list plus countries where signers
 * live. Official domains only; no phone numbers here because we
 * cannot keep them verified. `ministry` is the plain name the letters
 * and the call guidance use ("Ask the Ministry of External Affairs
 * what our government has done"); `home: true` marks Nepal, whose own
 * government runs the search, so its letters ask for the offered help
 * to be accepted instead of pressing a foreign ministry.
 */
export const COUNTRY_GUIDES = [
  {
    country: 'Australia',
    findRep: { label: 'Find your federal MP or senator (aph.gov.au)', url: 'https://www.aph.gov.au/Senators_and_Members' },
    consular: { label: 'DFAT consular services (Smartraveller)', url: 'https://www.smartraveller.gov.au/consular-services' },
    ministry: 'the Department of Foreign Affairs and Trade',
  },
  {
    country: 'United Kingdom',
    findRep: { label: 'Find your MP (parliament.uk)', url: 'https://members.parliament.uk/FindYourMP' },
    consular: { label: 'Foreign, Commonwealth and Development Office', url: 'https://www.gov.uk/government/organisations/foreign-commonwealth-development-office' },
    ministry: 'the Foreign, Commonwealth and Development Office',
  },
  {
    country: 'Singapore',
    findRep: { label: 'Members of Parliament (parliament.gov.sg)', url: 'https://www.parliament.gov.sg/mps/list-of-current-mps' },
    consular: { label: 'Ministry of Foreign Affairs Singapore', url: 'https://www.mfa.gov.sg' },
    ministry: 'the Ministry of Foreign Affairs',
  },
  {
    country: 'India',
    findRep: { label: 'Members of the Lok Sabha (sansad.in)', url: 'https://sansad.in/ls/members' },
    consular: { label: 'Ministry of External Affairs', url: 'https://www.mea.gov.in' },
    ministry: 'the Ministry of External Affairs',
  },
  {
    country: 'France',
    findRep: { label: 'Find your deputy (assemblee-nationale.fr)', url: 'https://www.assemblee-nationale.fr/dyn/vos-deputes' },
    consular: { label: 'Ministere de l\'Europe et des Affaires etrangeres', url: 'https://www.diplomatie.gouv.fr' },
    ministry: 'the Ministry for Europe and Foreign Affairs',
  },
  {
    country: 'South Africa',
    findRep: { label: 'Parliament of South Africa', url: 'https://www.parliament.gov.za' },
    consular: { label: 'Department of International Relations and Cooperation', url: 'https://www.dirco.gov.za' },
    ministry: 'the Department of International Relations and Cooperation',
  },
  {
    country: 'Nepal',
    findRep: { label: 'House of Representatives of Nepal (hr.parliament.gov.np)', url: 'https://hr.parliament.gov.np' },
    consular: { label: 'Ministry of Foreign Affairs, Nepal', url: 'https://mofa.gov.np' },
    ministry: 'the Ministry of Foreign Affairs',
    home: true,
    note: 'Nepal\'s own army and disaster authority run the search, and the government has asked partners for technical support. Ask your representative to press for the requested equipment and crews to reach the valley and for a named contact for your family.',
  },
  {
    country: 'Another country',
    findRep: null,
    consular: null,
    ministry: '',
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

/**
 * How many people of one nationality are on the families' list, so a
 * letter can say "and for the other 15 nationals of Australia on the
 * families' list". Typed country names fold to the list's; a country
 * with nobody on the list counts zero and the letters drop the clause.
 */
const NATIONALS_BY_COUNTRY = (() => {
  const counts = new Map();
  for (const p of missingPeople.people) {
    const key = String(p.country || '').trim().toLowerCase();
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
})();

export function nationalsOnList(country) {
  return NATIONALS_BY_COUNTRY.get(String(country || '').trim().toLowerCase()) || 0;
}

/**
 * Whether a name is one of the people on the families' list, under a
 * current or earlier printed name. Letters claim "on the families'
 * list" only for people actually on it: someone a writer adds by hand
 * is real but not yet listed, so their letter must not fold them into
 * the list's count (review finding on PR #229).
 */
const LISTED_NAME_KEYS = (() => {
  const keys = new Set();
  for (const p of missingPeople.people) {
    keys.add(normalizePersonKey(p.name));
    for (const alias of Array.isArray(p.aka) ? p.aka : []) keys.add(normalizePersonKey(alias));
  }
  return keys;
})();

export function onFamiliesList(name) {
  return LISTED_NAME_KEYS.has(normalizePersonKey(name));
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

/**
 * What Nepal has publicly asked its partners for (Foreign Minister
 * Shisir Khanal's statements, August 29 through September 1): the
 * list every letter and call now pins its ask to.
 */
const NEPAL_REQUESTS =
  'tunnel rescue specialists, help restoring transport where bridges were destroyed, DNA testing and forensic experts, and heavy-lift cargo drones';

/**
 * The emergency-disclosure ask (founder direction, 2026-09-02). Under
 * 18 U.S.C. 2702, Google, Apple, Meta, and the phone carriers may hand
 * a person's last known device location to a governmental entity in a
 * danger-of-death emergency; the request must come from law
 * enforcement (a sworn official, through the providers' law
 * enforcement portals), which is why every letter asks for a missing
 * person case to be opened first. Missing persons are a qualifying
 * emergency in the providers' own policies.
 */
const EDR_PROVIDERS = 'Google, Apple, Meta, and the phone carriers';

// Figures sourced 2026-09-02: the families' letter as it read on
// September 1 (the counts of Americans, Nepal's disaster authority and
// China's missing counts, the rescue total, the barrier lakes), Nepal's
// Foreign Minister's public statements of August 29 through
// September 1 and his September 1 CNN interview (air pockets in the
// blocked tunnels, no refusal of foreign support ever announced, the
// day-two request for tunnel rescue help and day-three team arrivals),
// and the Department's announced assistance. Organizers: update these
// paragraphs and FACTS_DATE together whenever the situation moves.
const SITUATION_US =
  'The State Department has said that 90 Americans remain unaccounted for and that five have been rescued. ' +
  'Nepal\'s disaster authority has confirmed 579 deaths and lists 1,924 people missing, China reports 558 missing on its side of the border, and Nepali crews have rescued more than 3,700 people. ' +
  'Helicopters still cannot land in parts of the upper valley; rescue work was suspended when the barrier lake above the valley overflowed, has resumed under a flood alert, and a second lake has since formed. ' +
  `On August 29, Nepal's Foreign Minister said publicly that Nepal has not rejected foreign rescue assistance and is requesting targeted technical support for specific needs: ${NEPAL_REQUESTS}. ` +
  'In a televised CNN interview, the Foreign Minister said engineering analysis shows air pockets deep inside the blocked tunnels and that he is very hopeful many people could still be alive in them. ' +
  'He said Nepal never announced it would refuse foreign support and takes it in the areas where the need is greatest: Nepal asked for tunnel rescue capability on the second day of the disaster, and the Indian and Chinese teams now working alongside the Nepal Army were arriving by the third. ' +
  'Australia and South Korea have sent experts. ' +
  `As of ${FACTS_DATE}, the announced United States response consisted of monitoring, a hotline, $500,000 in relief supplies, one disaster response adviser, and $3.6 million in emergency humanitarian assistance, with no American search team or technical unit reported in the valley.`;

const SITUATION_INTL =
  'Nepal\'s disaster authority has confirmed 579 deaths and lists 1,924 people missing, and China reports 558 missing on its side of the border. ' +
  'The missing include pilgrims, guides, and workers from Nepal, India, Australia, the United Kingdom, Singapore, the United States, and more than two dozen other countries. ' +
  'Nepali crews have rescued more than 3,700 people, but helicopters still cannot land in parts of the upper valley. ' +
  `On August 29, Nepal's Foreign Minister said publicly that Nepal has not rejected foreign rescue assistance and is requesting targeted technical support for specific needs: ${NEPAL_REQUESTS}. ` +
  'In a televised CNN interview, the Foreign Minister said engineering analysis shows air pockets deep inside the blocked tunnels and that he is very hopeful many people could still be alive in them. ' +
  'He said Nepal never announced it would refuse foreign support: Nepal asked for tunnel rescue capability on the second day of the disaster, and the Indian and Chinese teams now on the ground were arriving by the third.';

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

/**
 * The joint-letter sentence every generated letter carries. The joint
 * letter is a living document, with signatures and names still
 * arriving, so this leads with the current totals instead of a
 * delivery-day snapshot that goes stale (founder feedback, 2026-09-01:
 * the frozen "On August 29, 1,189..." figure kept reading as outdated).
 * August 29 stays as the delivery fact an office can verify, and the
 * count rises to the live roster number when the wizard has one that
 * is larger than the letter's own floor. General letters (written for
 * everyone on the list, not one family's person) drop "my family
 * among them".
 */
export function jointLetterSentence(signers, { mine = true } = {}) {
  const live = Number(signers);
  const count = Number.isFinite(live) && live > LETTER_SIGNERS ? live : LETTER_SIGNERS;
  return (
    `More than ${count.toLocaleString('en-US')} family members and friends of ${LETTER_MISSING} missing people, ` +
    `${mine ? 'my family among them, ' : ''}have signed the families' joint letter to the United States Secretary of State, ` +
    `first delivered on August 29 and updated since as signatures keep arriving. It asks for seven actions: ${SEVEN_ASKS}`
  );
}

/**
 * How a general letter (no one person named) is recorded in the
 * families' letter record, so the chart can count letters written for
 * everyone alongside the per-person rows.
 */
export const GENERAL_RECORD_NAME = 'All the missing';

/**
 * The no-excuse paragraph (founder direction, 2026-09-01: the State
 * Department was still telling families it could do nothing "because
 * Nepal is not asking for assistance"). Nepal's request is now public
 * and specific, so every letter pins its ask to that list and demands
 * the government's offer against it be on the record. Supersedes the
 * consent-obtaining framing from 2026-08-31.
 */
/**
 * Bumped whenever the generated letter wording changes in a way every
 * letter must carry (v2: the consent paragraph; v3: the August 31
 * facts and the Foreign Ministry's technical-support opening; v4: the
 * living joint-letter framing with the current signer and missing
 * counts and the letter's own casualty figures; v5: named foreign
 * ministries, the nationals-on-the-list counts, and the Nepal
 * home-country variant; v6: Nepal's public request for technical
 * support replaces the consent-obtaining framing, with the
 * September 1 letter totals; v7: the emergency-disclosure ask for
 * last known device locations; v8: the Foreign Minister's televised
 * CNN interview: air pockets in the blocked tunnels, no refusal of
 * foreign support ever announced, the day-two request and day-three
 * team arrivals). Drafts store the version they were
 * edited under; restoring hand edits from an older template rebuilds
 * the letters and says so, instead of silently sending the old
 * wording (review findings on PR #223 and PR #225).
 */
export const LETTER_TEMPLATE_VERSION = 8;

function accessParagraph(government) {
  return (
    'If any of this is said to be waiting on a request from the Government of Nepal, that request has been made. ' +
    `On August 29, Nepal's Foreign Minister said publicly that Nepal has not rejected foreign rescue assistance and is requesting targeted technical support: ${NEPAL_REQUESTS}. ` +
    'In a televised CNN interview he went further: Nepal never announced it would refuse foreign support, it asked for tunnel rescue capability on the second day of the disaster, and the Indian and Chinese teams now working alongside the Nepal Army were arriving by the third. ' +
    `Ask what ${government} has offered against each item on Nepal's list, on what date, and when each arrives; and if the answer is nothing, the families should be told so, on the record.`
  );
}

/**
 * The same facts turned around, for writers inside Nepal: their own
 * government made the request, so the letter presses for the asked-for
 * help to reach the valley and for families to see the ledger.
 */
const HOME_COUNTRY_PARAGRAPH =
  `Nepal's Foreign Ministry has asked friendly governments for targeted technical support, ${NEPAL_REQUESTS}, and specialist teams from India and China have begun arriving. ` +
  'I am asking for the requested equipment and crews to reach the valley quickly, and for families to be told what was requested, what has arrived, and what is still missing.';

/**
 * The prepared question for callers inside Nepal, where the consent
 * comeback would read backwards: their government holds the answer
 * about accepting the offered help, not about offering it.
 */
export const HOME_COMEBACK = {
  title: 'If they say "the offers are being reviewed"',
  ask: 'Which offers of technical support has the government received, which have been accepted, and when does each reach the valley?',
  note:
    'A specific list with dates is an answer a family can hold on to. ' +
    'Ask the office to find out and call you back with it.',
};

/** Rendered on the delivery step under the phone script, for every path. */
export const ACCESS_COMEBACK = {
  title: 'If they say "Nepal has not asked for assistance"',
  ask:
    'Nepal\'s Foreign Minister has said, on August 29 and again in a televised CNN interview, that Nepal never announced it would refuse foreign support and takes it where the need is greatest. ' +
    'Nepal asked for tunnel rescue capability on the second day of the disaster, Indian and Chinese teams were arriving by the third, and the standing public request is: tunnel rescue specialists, bridge restoration, DNA and forensic experts, and heavy-lift cargo drones. ' +
    'The Minister also said air pockets deep in the blocked tunnels could be keeping many people alive. What have we offered against Nepal\'s list, and when does it arrive?',
  note:
    'A staffer repeating an old line cannot answer that. Ask them to find out and call you back. ' +
    'If an offer has been made, the families should be told what and when; if none has, that is the answer, on the record.',
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

/**
 * `person` is optional everywhere below (founder direction, 2026-09-02):
 * some writers stand for everyone on the list rather than one family
 * member. Passing null builds the general letter: the people missing,
 * the list's counts, and the same demands, with no casework asks.
 */
export function buildSubject({ writer, person, recipient }) {
  if (!person) {
    if (recipient && recipient.chamber === 'mp') {
      const riding = recipient.riding && recipient.riding.trim() ? recipient.riding.trim() : '[your riding]';
      return `Constituent in ${riding}: the Canadians missing in the Rasuwa flood in Nepal. Request for action.`;
    }
    if (writer.inUS) {
      const city = ph(writer.city, 'your city');
      const state = ph(writer.state, 'ST');
      return `Constituent in ${city}, ${state}: the Americans missing in the Rasuwa flood in Nepal. Request for action.`;
    }
    return 'The people missing in the Rasuwa flood in Nepal. Request for action.';
  }
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
  // No person means a general letter: the writer stands for everyone
  // on the families' list. Same facts, same demands, no casework asks.
  if (!person) {
    const writerName = ph(writer.name, 'your name');
    const phone = ph(writer.phone, 'your phone number');
    const email = writer.email && writer.email.trim() ? ` and ${writer.email.trim()}` : '';
    const reach = `I can be reached at ${phone}${email}. Time matters in a search. Please treat this as urgent.`;

    if (recipient.chamber === 'mp') {
      const mpName = ph(recipient.name, "your MP's name");
      const riding = recipient.riding && recipient.riding.trim() ? recipient.riding.trim() : '[your riding]';
      const caCount = nationalsOnList('Canada');
      return (
        `${recipientAddressLines(recipient).join('\n')}\n\n` +
        `${longDate()}\n\n` +
        `Re: ${buildSubject({ writer, person: null, recipient })}\n\n` +
        `Dear ${mpName}:\n\n` +
        `I am your constituent in ${riding}. I am writing about the Canadians missing since ${FLOOD_SENTENCE}. The families' list holds ${LETTER_MISSING} missing people, ${caCount} of them Canadian.\n\n` +
        `${SITUATION_INTL} ${jointLetterSentence(signers, { mine: false })} ${LETTER_POINTER}.\n\n` +
        `I ask you to do four things:\n\n` +
        `1. Contact Global Affairs Canada's Emergency Watch and Response Centre today, ask what Canada has done for the Canadians missing in Rasuwa, and press for Canada to answer Nepal's public request for technical support: ${NEPAL_REQUESTS}.\n\n` +
        `2. Ask Global Affairs Canada to give every Canadian family a named consular contact with a daily update until their person is accounted for.\n\n` +
        `3. Ask the RCMP to open missing person cases for the missing Canadians and to make emergency disclosure requests to ${EDR_PROVIDERS}, so that last known device locations reach the search coordinators.\n\n` +
        `4. Press for consular coordination with Nepal and China on search access at the Gyirong border and on shared lists of the rescued and the recovered.\n\n` +
        `${accessParagraph('Canada')}\n\n` +
        `${reach}\n\n` +
        `Respectfully,\n\n` +
        `${writerName}\n` +
        `(Facts as of ${FACTS_DATE}.)`
      );
    }

    if (recipient.chamber === 'intl') {
      const guide = findCountryGuide(writer.country);
      const ministry = guide.ministry || 'our foreign ministry';
      const wc = String(writer.country || '').trim();
      const wcCount = nationalsOnList(wc);
      const stake =
        wc && wcCount >= 1
          ? ` ${wcCount === 1 ? 'One of them is a national' : `${wcCount} of them are nationals`} of ${wc}.`
          : '';
      const asks = guide.home
        ? `1. Ask the officers coordinating the search what has been done for the missing, and press for the requested international technical support, ${NEPAL_REQUESTS}, to reach the valley and be put to work.\n\n` +
          `2. Press for every family to have a named point of contact with a daily update.\n\n` +
          `3. Ask Nepal Police to make emergency disclosure requests to ${EDR_PROVIDERS} for the last known device locations of the missing, shared with the officers coordinating the search.\n\n` +
          `4. Press for coordination with China on search access at the Gyirong border and on shared lists of the rescued and the recovered.`
        : `1. Ask ${ministry} what our government has done for its nationals missing in Rasuwa, and press for our government to answer Nepal's public request for technical support: ${NEPAL_REQUESTS}.\n\n` +
          `2. Press for every affected family to have a named point of contact with a daily update.\n\n` +
          `3. Ask our national police to open missing person cases for our nationals missing in Rasuwa and to make emergency disclosure requests to ${EDR_PROVIDERS} for their last known device locations, shared with the search coordinators.\n\n` +
          `4. Coordinate with Nepal and China on search access at the Gyirong border and on shared lists of the rescued and the recovered.`;
      return (
        `${longDate()}\n\n` +
        `To: [name and office of your Member of Parliament or consular officer]\n\n` +
        `Re: ${buildSubject({ writer, person: null })}\n\n` +
        `Dear [name]:\n\n` +
        `I am writing about the people missing since ${FLOOD_SENTENCE}. The families' list holds ${LETTER_MISSING} missing people from Nepal, India, and more than two dozen other countries.${stake}\n\n` +
        `${SITUATION_INTL} ${jointLetterSentence(signers, { mine: false })} ${LETTER_POINTER}.\n\n` +
        `I ask you to do four things:\n\n` +
        `${asks}\n\n` +
        `${guide.home ? HOME_COUNTRY_PARAGRAPH : accessParagraph('our government')}\n\n` +
        `${reach}\n\n` +
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
    const usCount = nationalsOnList('United States');
    return (
      `${recipientAddressLines(recipient).join('\n')}\n\n` +
      `${longDate()}\n\n` +
      `Re: ${buildSubject({ writer, person: null })}\n\n` +
      `Dear ${title} ${lastName}:\n\n` +
      `I am your constituent. I live at ${street}, ${city}, ${state} ${zip}. I am writing about the Americans missing since ${FLOOD_SENTENCE}. The families' list holds ${LETTER_MISSING} missing people, ${usCount} of them American.\n\n` +
      `${SITUATION_US}\n\n` +
      `${jointLetterSentence(signers, { mine: false })} ${LETTER_POINTER}.\n\n` +
      `I ask you to do four things:\n\n` +
      `1. Contact the State Department's Bureau of Consular Affairs today. Ask what the United States has offered against each item Nepal has publicly requested, ${NEPAL_REQUESTS}, and press for the seven actions in the families' joint letter.\n\n` +
      `2. Press the Department for consular operations matched to the missing: a named liaison and a daily update for every family, officers at the Kathmandu hospitals and the forward base in Rasuwa, and disaster victim identification support.\n\n` +
      `3. Press the FBI and the Department of Justice to open missing person cases for the missing Americans and to send emergency disclosure requests under 18 U.S.C. 2702 to ${EDR_PROVIDERS}, so that last known device locations reach the officers coordinating the search.\n\n` +
      `4. Tell me what the Department answers, and put your support for the families' requests on the record.\n\n` +
      `${accessParagraph('the United States')}\n\n` +
      `${reach}\n\n` +
      `Respectfully,\n\n` +
      `${writerName}\n` +
      `${street}\n` +
      `${city}, ${state} ${zip}\n` +
      `(Facts as of ${FACTS_DATE}.)`
    );
  }

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
    // The country's stake, from the families' list itself; membership
    // is claimed only for people actually on the list.
    const mpListCount = nationalsOnList(person.country);
    const mpListed = onFamiliesList(person.name);
    const personLine = isCanadian
      ? (mpListed && mpListCount >= 2
          ? `one of the ${mpListCount} Canadians on the families' list, unaccounted for since ${FLOOD_SENTENCE}`
          : `one of the Canadians unaccounted for since ${FLOOD_SENTENCE}`)
      : (mpListed && mpListCount >= 2
          ? `a national of ${person.country || '[country]'}, one of the ${mpListCount} on the families' list, unaccounted for since ${FLOOD_SENTENCE}`
          : `a national of ${person.country || '[country]'} unaccounted for since ${FLOOD_SENTENCE}`);
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
      `I ask you to do four things:\n\n` +
      `1. Contact Global Affairs Canada's Emergency Watch and Response Centre today, ask what Canada has done for ${name} and for the other Canadians missing in Rasuwa, and press for Canada to answer Nepal's public request for technical support: ${NEPAL_REQUESTS}.\n\n` +
      `${askTwo}\n\n` +
      `3. Ask the RCMP or local police to open a missing person case for ${name} and to make emergency disclosure requests to ${EDR_PROVIDERS}, so that ${name}'s last known device location reaches the search coordinators.\n\n` +
      `4. Press for consular coordination with Nepal and China on search access at the Gyirong border and on shared lists of the rescued and the recovered.\n\n` +
      `${accessParagraph('Canada')}\n\n` +
      `I can be reached at ${phone}${email}. Time matters in a search. Please treat this as urgent.\n\n` +
      `Respectfully,\n\n` +
      `${writerName}\n` +
      `(Facts as of ${FACTS_DATE}.)`
    );
  }

  if (recipient.chamber === 'intl') {
    const country = person.country || '[country]';
    // The writer addresses their own government, so the ministry and
    // the home-country variant follow where the writer lives; the
    // nationals count follows the missing person's country.
    const guide = findCountryGuide(writer.country || person.country);
    const ministry = guide.ministry || 'our foreign ministry';
    const intlListCount = nationalsOnList(person.country);
    // "the other 15" only when this person is one of the 16; someone
    // added by hand is in addition to the list's count.
    const othersOnList = onFamiliesList(person.name)
      ? (intlListCount >= 2
          ? ` and for the other ${intlListCount === 2 ? 'national' : `${intlListCount - 1} nationals`} of ${country} on the families' list`
          : '')
      : (intlListCount >= 2
          ? ` and for the ${intlListCount} nationals of ${country} on the families' list`
          : '');
    const asks = guide.home
      ? `1. Ask the officers coordinating the search what has been done to find ${name}${othersOnList}, and press for the requested international technical support, ${NEPAL_REQUESTS}, to reach the valley and be put to work.\n\n` +
        `2. Give me a named point of contact with an update every day until ${name} is accounted for.\n\n` +
        `3. Ask Nepal Police to make emergency disclosure requests to ${EDR_PROVIDERS} for ${name}'s last known device location, shared with the officers coordinating the search.\n\n` +
        `4. Press for coordination with China on search access at the Gyirong border and on shared lists of the rescued and the recovered.`
      : `1. Ask ${ministry} what our government has done to date for ${name}${othersOnList}, and press for our government to answer Nepal's public request for technical support: ${NEPAL_REQUESTS}.\n\n` +
        `2. Open a case file for ${name} and give me a named point of contact with a daily update.\n\n` +
        `3. Ask our national police to open a missing person case for ${name} and to make emergency disclosure requests to ${EDR_PROVIDERS} for ${name}'s last known device location, shared with the search coordinators.\n\n` +
        `4. Coordinate with Nepal and China on search access at the Gyirong border and on shared lists of the rescued and the recovered.`;
    return (
      `${longDate()}\n\n` +
      `To: [name and office of your Member of Parliament or consular officer]\n\n` +
      `Re: ${buildSubject({ writer, person })}\n\n` +
      `Dear [name]:\n\n` +
      `I am writing about my ${relationship}, ${personIntro(person)}, who has been unaccounted for since ${FLOOD_SENTENCE}.\n\n` +
      `${lastSeenSentence(person)}${details}\n\n` +
      `${SITUATION_INTL} ${jointLetterSentence(signers)} ${LETTER_POINTER}.\n\n` +
      `I ask you to do four things:\n\n` +
      `${asks}\n\n` +
      `${guide.home ? HOME_COUNTRY_PARAGRAPH : accessParagraph('our government')}\n\n` +
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
    `I ask you to do four things:\n\n` +
    `1. Contact the State Department's Bureau of Consular Affairs today. Ask what the United States has offered against each item Nepal has publicly requested, ${NEPAL_REQUESTS}, and press for the seven actions in the families' joint letter.\n\n` +
    `${askTwo}\n\n` +
    `3. Ask the Federal Bureau of Investigation to open a missing person case for ${name} and to send emergency disclosure requests under 18 U.S.C. 2702 to ${EDR_PROVIDERS}, so that ${name}'s last known device location reaches the officers coordinating the search.\n\n` +
    `4. Have a caseworker give me a named point of contact and an update every day until ${name} is accounted for.\n\n` +
    `${accessParagraph('the United States')}\n\n` +
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
  if (!person) {
    if (recipient && recipient.chamber === 'mp') {
      const riding = recipient.riding && recipient.riding.trim() ? ` in ${recipient.riding.trim()}` : '';
      return (
        `Hello, my name is ${ph(writer.name, 'your name')}. I am a constituent${riding}. ` +
        `I am calling about the Canadians missing in the August 26 flood in Nepal's Rasuwa district. ` +
        `I am asking the MP to press Global Affairs Canada to act for the families and to answer Nepal's public request for technical support. ` +
        `My number is ${ph(writer.phone, 'your phone number')}. Which staff member will handle this?`
      );
    }
    const title = recipient && recipient.chamber !== 'intl' ? `${recipientTitle(recipient)} ${recipientLastName(recipient)}` : 'your office';
    return (
      `Hello, my name is ${ph(writer.name, 'your name')}. I am a constituent in ${ph(writer.city, 'your city')}. ` +
      `I am calling about the Americans missing in the August 26 flood in Nepal's Rasuwa district. ` +
      `I am asking ${title} to press the State Department to act on the families' joint letter and to answer Nepal's public request for technical support. ` +
      `My number is ${ph(writer.phone, 'your phone number')}. Which staff member will handle this?`
    );
  }
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
    `I am asking ${title} to do two things: press the State Department to act on the families' joint letter, and open a casework file for ${name}. ` +
    `Please send me the office's privacy release form today. ` +
    `My number is ${ph(writer.phone, 'your phone number')}. Which caseworker will handle this?`
  );
}

/**
 * Mailto content for sending the person's entry to the coordinating family,
 * so the consolidated roster and the letters stay in step.
 */
export function buildRosterShare({ writer, person }) {
  person = person && typeof person === 'object' ? person : {};
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
