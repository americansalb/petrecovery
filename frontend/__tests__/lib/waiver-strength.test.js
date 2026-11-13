/**
 * The waiver, the record of who agreed to it, and the training that
 * follows.
 *
 * Founder, 2026-11-12: "We need to find a stronger way to remove any
 * liability. I know the waiver and maybe a bit of optional training on
 * rescue? but not say its optional".
 */
import fs from 'fs';
import path from 'path';
import { LIABILITY_WAIVER_DOC } from '@/prisma/legal/liability-waiver';
import { WAIVER_VERSION, waiverIsCurrent } from '@/app/lib/waiverVersion';
import { SAFETY_AGREEMENT, searchTraining } from '@/app/lib/safetyRules';

const read = (file) => fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');
const text = LIABILITY_WAIVER_DOC.content;

describe('what the waiver says', () => {
  test('the version in force is the version of the text', () => {
    expect(WAIVER_VERSION).toBe(LIABILITY_WAIVER_DOC.version);
    expect(text).toContain(`Version ${WAIVER_VERSION}.`);
  });

  test('it says what the site is not: it checks no ground, the map can be wrong, no warning does not mean safe', () => {
    expect(text).toMatch(/does not inspect, visit or know the condition of any place/);
    expect(text).toMatch(/can be wrong, out of date or incomplete/);
    expect(text).toMatch(/An area with no warning on it is not safe ground\./);
    expect(text).toMatch(/not an emergency service/);
  });

  test('the helper is a volunteer who chooses, and nobody\'s employee or agent', () => {
    expect(text).toMatch(/not an employee, agent or contractor/);
    expect(text).toMatch(/is a suggestion\. You may turn any of it down/);
    expect(text).toMatch(/Nobody supervises you/);
  });

  test('the risks are named: roads, water, rail, the dark, animals, other people, the phone', () => {
    for (const risk of [/Roads and traffic/, /Water of any kind/, /Rail lines and trains/, /searching in the dark/, /Animals, including the pet/, /Other people, including confrontation/, /distracted by your phone/]) {
      expect(text).toMatch(risk);
    }
  });

  test('it is for adults, and a child comes only with their own parent or guardian', () => {
    expect(text).toMatch(/You are 18 or older\./);
    expect(text).toMatch(/only with their own parent or legal guardian/);
  });

  test('the release covers negligence, names the owner and the other helpers, and keeps what the law will not let go', () => {
    expect(text).toMatch(/To the fullest extent the law allows, you release and agree not to sue/);
    expect(text).toMatch(/the owner of any pet you help look for/);
    expect(text).toMatch(/everyone else helping in a search/);
    expect(text).toMatch(/INCLUDING WHERE IT IS CAUSED BY THE NEGLIGENCE OF A RELEASED PARTY/);
    expect(text).toMatch(/does not apply to gross negligence, recklessness or intentional misconduct/);
    expect(text).toMatch(/## 7\. Indemnity/);
  });

  test('it promises nothing for the company, and carries no emoji or old name', () => {
    expect(text).not.toMatch(/[☀-➿\u{1F300}-\u{1FAFF}]/u);
    // The released party is ReunitePets. (The contact address is still on the old domain: app/lib/brand.js.)
    expect(text).not.toMatch(/PetRecovery\.org/);
    expect(text).not.toMatch(/squad leader/i);
    expect(text).toMatch(/provides no insurance of any kind/);
  });
});

describe('which acceptances count', () => {
  test('only one of the text as it reads today', () => {
    const when = new Date();
    expect(waiverIsCurrent(when, WAIVER_VERSION)).toBe(true);
    expect(waiverIsCurrent(when, '1.0')).toBe(false);
    expect(waiverIsCurrent(when, '1.1.0')).toBe(false);
    expect(waiverIsCurrent(when, null)).toBe(false);
    expect(waiverIsCurrent(null, WAIVER_VERSION)).toBe(false);
  });

  test('the search asks through that check, for an account and for someone without one', () => {
    const searcher = read('app/lib/searcher.js');
    expect(searcher).toMatch(/waiver: waiverIsCurrent\(user\.waiverAcceptedAt, user\.waiverVersionAccepted\) \|\| isOwner,/);
    expect(searcher).toMatch(/waiver: waiverIsCurrent\(volunteer\.waiverAcceptedAt, volunteer\.waiverVersionAccepted\),/);
    expect(read('app/lib/waiver.js')).toMatch(/return waiverIsCurrent\(user\?\.waiverAcceptedAt, user\?\.waiverVersionAccepted\)/);
  });

  test('someone out on an area when the version changed can still say they searched it', () => {
    expect(read('app/api/mission/[missionId]/board/route.js')).toMatch(/const finishing = action === 'searched' && searcher\.signedBefore;/);
  });
});

describe('the record of an agreement', () => {
  const accept = read('app/api/legal/accept-waiver/route.js');
  const ops = read('app/lib/missionControl/volunteerOps.js');
  const lib = read('app/lib/waiver.js');

  test('the version written is the one in force, never a constant or what a request says', () => {
    expect(accept).toMatch(/waiverVersionAccepted: WAIVER_VERSION,/);
    expect(accept).not.toMatch(/waiverVersionAccepted: '1\.0'/);
    expect(ops).not.toMatch(/waiverVersionAccepted: waiverVersion/);
    expect(ops.match(/waiverVersionAccepted: WAIVER_VERSION,/g)).toHaveLength(2);
  });

  test('a screen that showed an older text cannot agree to this one', () => {
    expect(accept).toMatch(/if \(shownAnOldWaiver\(shownVersion\)\) \{\s+return NextResponse\.json\(\{ error: WAIVER_CHANGED_WORDS, code: WAIVER_CHANGED_CODE/);
    expect(ops).toMatch(/if \(waiverVersion && String\(waiverVersion\) !== WAIVER_VERSION\) \{\s+return \{ success: false, error: [^}]+code: 'WAIVER_CHANGED' \};/);
  });

  test('each agreement keeps who, which version, when and from where', () => {
    const schema = read('prisma/schema.prisma');
    const model = schema.slice(schema.indexOf('model WaiverAcceptance {'), schema.indexOf('model LegalDocument {'));
    for (const field of ['userId', 'volunteerId', 'caseId', 'name', 'version', 'shownVersion', 'adult', 'ipAddress', 'userAgent', 'trainedAt', 'createdAt']) {
      expect(model).toMatch(new RegExp(`\\n  ${field}\\s`));
    }
    expect(lib).toMatch(/prisma\.waiverAcceptance\.create\(/);
    expect(accept).toMatch(/await recordWaiver\(\{/);
    expect(read('app/api/mission/[missionId]/volunteer/route.js')).toMatch(/if \(result\?\.success\) \{\s+await recordWaiver\(\{ request, userId, volunteerId: result\.volunteerId, caseId: caseRow\.id/);
  });

  test('a failure to write the proof turns nobody away', () => {
    expect(lib).toMatch(/Never throws/);
    expect(lib).toMatch(/\} catch \(error\) \{\s+console\.error\('\[waiver\] the record of an acceptance was not written:'/);
  });
});

describe('the join screen', () => {
  const helper = read('app/mission-control/steps/Helper.js');

  test('the card has the tick, the text one tap away and the button, and does not print the release', () => {
    // Founder, 2026-11-13: "If you put too many warnings you are putting the idea in people's heads. That is
    // part of the reason you put it kinda tucked away in waiver no one reads".
    const tick = helper.indexOf('{SAFETY_AGREEMENT}');
    const toggle = helper.indexOf("'Read them'");
    const button = helper.indexOf('I agree', toggle);
    expect(tick).toBeGreaterThan(-1);
    expect(tick).toBeLessThan(toggle);
    expect(toggle).toBeLessThan(button);
    expect(helper).toMatch(/\{waiver\?\.content \|\| 'Loading the waiver\.'\}/);
    expect(helper).not.toMatch(/WAIVER_IN_SHORT|right to sue|at your own risk/);
    // The release itself is in the waiver, in capitals, where it belongs.
    expect(text).toMatch(/INCLUDING WHERE IT IS CAUSED BY THE NEGLIGENCE OF A RELEASED PARTY/);
    expect(text).toMatch(/You search at your own risk\./);
  });

  test('the tick says the person is an adult', () => {
    expect(SAFETY_AGREEMENT).toMatch(/^I am 18 or older\./);
  });

  test('the version the screen showed goes with the agreement, signed in or not', () => {
    expect(helper).toMatch(/search\.acceptWaiver\(\{ waiverVersion: waiver\?\.version \|\| null \}\)/);
    expect(helper).toMatch(/search\.join\(\{ name: first, waiverVersion: waiver\?\.version \|\| null \}\)/);
  });
});

describe('the training', () => {
  const helper = read('app/mission-control/steps/Helper.js');
  const points = searchTraining('Max');

  test('it covers public ground, roads water and rail, the phone, not chasing, a dangerous animal, the dark, and emergencies', () => {
    const all = points.map((p) => `${p.title}. ${p.text}`).join(' ');
    for (const said of [/public ground/, /roads, water and rail lines/, /Phone away while you move/, /Do not chase or grab/, /growls, snaps or looks sick/, /After dark, go with someone/, /local emergency number/]) {
      expect(all).toMatch(said);
    }
    expect(all).toContain('"I\'ve seen Max"');
    expect(points.length).toBeLessThanOrEqual(7);
  });

  test('it comes after agreeing, and its one button gives them their ground', () => {
    expect(helper).toMatch(/setStage\('training'\);/);
    expect(helper).toMatch(/if \(stage === 'training'\) return <Training /);
    expect(helper).toMatch(/<Heading>Before you go out<\/Heading>/);
    expect(helper).toMatch(/I understand\. Give me \{ground \? 'an area'/);
  });

  test('nothing the helper reads calls it optional, and there is no way round it on the screen', () => {
    const from = helper.indexOf('export function Training(');
    const screen = helper.slice(from, helper.indexOf('\nexport function ', from + 10));
    expect(from).toBeGreaterThan(-1);
    expect(screen).not.toMatch(/>[^<{]*\b(optional|skip|later|not now)\b/i);
    expect(screen).not.toMatch(/QuietLink/);
    expect(points.map((p) => `${p.title} ${p.text}`).join(' ')).not.toMatch(/optional|if you like|if you want/i);
  });

  test('finishing it is recorded, and the server refuses nobody for want of it', () => {
    expect(helper).toMatch(/search\.trained\?\.\(\)\.catch\(\(\) => \{\}\);/);
    expect(helper).toMatch(/onGo=\{setOff\}/);
    expect(read('app/api/mission/[missionId]/trained/route.js')).toMatch(/recordTrained\(\{ userId: searcher\.userId, volunteerId: searcher\.volunteerId \}\)/);
    const board = read('app/api/mission/[missionId]/board/route.js');
    expect(board).not.toMatch(/trainedAt|recordTrained|trained\b/);
  });
});
