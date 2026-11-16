/**
 * The page after posting says only what happened
 * (app/components/report/successWords.js, SuccessScreen.js, MatchCard.jsx).
 *
 * Found in testing before publishing: "We texted this link" after the text
 * failed; "Sent to Mexico City Pet Rescue, which covers the spot" for a
 * force set up a second before with the owner as its only member; "The
 * flyer is on the page when it is ready" after the drawing had failed; and
 * on the found side "The owner ... may reach out to you directly",
 * "In-app messaging is rolling out soon" and "Messages from owners land
 * there", none of which was true.
 */

const fs = require('fs');
const path = require('path');

import { lostLinkLine, lostForceLine, lostNeighborsLine, foundLines, finderReplyNote, KIT_WORDS } from '@/app/components/report/successWords';
import { ownerAlertedWords } from '@/components/case/MatchCard';

const text = (parts) => parts.map((p) => (typeof p === 'string' ? p : p.strong)).join('');
const PHONE = { contactPhone: '5125550142', phoneLabel: '(512) 555-0142', name: 'Max' };

describe('the link line', () => {
  test('a text is said to have gone only when it went', () => {
    expect(text(lostLinkLine({ ...PHONE, told: { text: 'sent' } }))).toBe("We texted (512) 555-0142 the link that runs Max's search. When someone reports seeing Max, we text you there.");
    expect(text(lostLinkLine({ ...PHONE, told: { text: 'failed' } }))).toBe('We could not text (512) 555-0142. Copy the link above and keep it.');
    expect(text(lostLinkLine({ ...PHONE, told: { text: 'sending' } }))).toBe('We are texting the link to (512) 555-0142.');
    // Not told at all: no claim either way.
    expect(text(lostLinkLine({ ...PHONE }))).toBe('Copy the link above and keep it.');
  });

  test('an email the same', () => {
    const guest = { contactEmail: 'avery@example.com', name: 'Max' };
    expect(text(lostLinkLine({ ...guest, told: { email: 'sent' } }))).toBe('We emailed this link to avery@example.com. Sightings are emailed there too.');
    expect(text(lostLinkLine({ ...guest, told: { email: 'failed' } }))).toBe('We could not email the link to avery@example.com. Copy it above and keep it.');
    expect(text(lostLinkLine({ ...guest, isLoggedIn: true }))).toBe('Sightings are emailed to avery@example.com.');
  });
});

describe('the force line', () => {
  test('a force set up by this report is not said to cover the spot or to have been sent anything', () => {
    const line = lostForceLine({ assignedSquad: { id: 'f-new', name: 'Mexico City Pet Rescue', setUpNow: true, membersAlerted: 0 }, squadsNotified: 1, name: 'Max' });
    expect(line).toBe('No Rescue Force covered this spot yet, so Mexico City Pet Rescue was started for it, with you as its first member.');
    expect(line).not.toMatch(/covers the spot|Sent to/);
  });

  test('a force that covers the spot is named with how many members were alerted and how', () => {
    expect(lostForceLine({ assignedSquad: { name: 'Austin Pet Rescue', membersAlerted: 12, membersPushed: 3 }, squadsNotified: 1, name: 'Max' })).toBe(
      'Sent to Austin Pet Rescue, which covers the spot where Max was last seen. 12 members were alerted in the app, 3 of them on their phone.'
    );
    expect(lostForceLine({ assignedSquad: { name: 'Austin Pet Rescue', membersAlerted: 0 }, squadsNotified: 1, name: 'Max' })).toBe(
      'Sent to Austin Pet Rescue, which covers the spot where Max was last seen. It has no other members to alert yet.'
    );
    expect(lostForceLine({ name: 'Max' })).toBe('No Rescue Force covers the spot yet. The report is on the Lost and Found board.');
    expect(lostNeighborsLine({ told: { neighbors: 2 } })).toBe('2 neighbors who watch for lost pets near the spot get an alert in the app.');
    expect(lostNeighborsLine({ told: { neighbors: 0 } })).toBeNull();
  });
});

describe('the found side', () => {
  test('the finder is told what went, and where a message from an owner will come', () => {
    const lines = foundLines({ contactEmail: 'finder@example.com', told: { email: 'sent' }, matchesNotified: 1, word: 'cat' }).map(text);
    expect(lines).toEqual(['We emailed the link to finder@example.com.', 'We sent the owner of a lost cat that looks like this one a link to your report.']);
    const note = finderReplyNote({ contactEmail: 'finder@example.com' });
    expect(note).toBe('If an owner writes to you through the site, the message comes to finder@example.com.');
    expect(ownerAlertedWords({ petName: 'Mia', replyNote: note })).toBe(`We sent Mia's owner a link to your report. ${note}`);
    expect(ownerAlertedWords({ petName: 'Mia', ownerTold: false })).toBe("We could not reach Mia's owner just now. Open their page to see how to reach them.");
  });
});

describe('the words in the files', () => {
  const read = (rel) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
  const FILES = [
    'app/components/report/SuccessScreen.js',
    'app/components/report/successWords.js',
    'components/case/MatchCard.jsx',
    'components/case/MessageFinder.jsx',
    'app/report/found/page.js',
    'app/report/found/message/page.js',
    'app/report/found/message/MessageFinderPage.js',
  ];

  test('no promise of what is not there, and no em dashes', () => {
    for (const file of FILES) {
      const src = read(file);
      expect([file, /rolling out soon/i.test(src)]).toEqual([file, false]);
      expect([file, /on the page when it is ready/i.test(src)]).toEqual([file, false]);
      expect([file, /Messages from owners land there/i.test(src)]).toEqual([file, false]);
      expect([file, /may reach out to you directly/i.test(src)]).toEqual([file, false]);
      expect([file, src.includes(String.fromCharCode(0x2014))]).toEqual([file, false]);
    }
  });

  test('a drawing that did not come out is said plainly, with a way to try again', () => {
    expect(KIT_WORDS.flyerMissing).toBe('The flyer did not draw.');
    expect(KIT_WORDS.shareMissing).toBe('The share image did not draw.');
    expect(read('app/components/report/SuccessScreen.js')).toContain('/redraw');
  });
});
