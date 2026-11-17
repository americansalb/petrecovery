/**
 * The lost report in seven screens (founder, 2026-11-17), and what a phone
 * audit at 393x852 and 375x667 found in the twelve-screen form:
 *
 *  - The home page said "Takes about a minute" while the form took 18 taps
 *    and 12 question screens.
 *  - The counter went from "1 of 11" to "2 of 12" after the first answer.
 *  - 64% of the form's text was 12 to 14px; sublabels and "We text you when
 *    someone reports a sighting" were 12px.
 *  - Every screen repeated a "flyer so far" card nobody could read.
 *  - A grey Continue sat under screens that move on at a tap.
 *  - The "When" hint said under an hour is urgent; "A few hours ago" was
 *    tagged urgent too.
 *  - "Use my location" set the spot the whole search circle is drawn around
 *    and moved on without showing it, and the screen had two of them.
 *
 * Size, the other colors, health and the reward are asked right after
 * posting (DetailsHub on the page after posting and the pet's page), and the
 * flyer is drawn again once after the answers.
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { lostScreenOrder } from '@/app/components/report/lost/screens';
import { LOST_TIME_OPTIONS } from '@/app/components/report/wizardTheme';
import DetailsChecklist from '@/app/components/report/lost/DetailsChecklist';
import SpotMap, { tilesAround } from '@/app/components/report/lost/SpotMap';
import { knownSize, colorWithOthers, normalizeDetails, factsBits } from '@/app/lib/caseDetails';
import { coatColorName, COAT_COLOR_NAMES } from '@/app/lib/coatColors';

const APP = path.join(__dirname, '..', 'app');
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8');
const wizard = read('report/new/page.js');
const screen = (id) => {
  const start = wizard.indexOf(`{stepId === '${id}'`);
  return wizard.slice(start, wizard.indexOf('</StepScreen>', start));
};

describe('seven screens, counted the same from the first to the last', () => {
  test('photo, pet, color, when and where, with people, contact, post', () => {
    for (const who of [{}, { isLoggedIn: true }, { isLoggedIn: true, hasPets: true }]) {
      expect(lostScreenOrder(who)).toHaveLength(7);
      expect(lostScreenOrder(who).slice(-1)).toEqual(['review']);
    }
    expect(lostScreenOrder({})).toEqual(['photo', 'pet', 'color', 'place', 'behaviour', 'contact', 'review']);
  });

  test('the count depends on who is reporting, never on an answer', () => {
    expect(wizard).toMatch(/const screenOrder = useMemo\(\(\) => lostScreenOrder\(\{ isLoggedIn, hasPets \}\), \[isLoggedIn, hasPets\]\);/);
    expect(wizard).toMatch(/const progress = \{ done: screenIndex \+ 1, total: screenOrder\.length \};/);
    // The first screen waits for the saved pets, so the order is settled before it shows.
    expect(wizard).toMatch(/myPets === null \|\| openSearch === undefined\) return;\s*setStepId\(screenOrder\[0\]\);/);
  });

  test('size, health and the reward are not asked or sent before posting', () => {
    for (const gone of ["'size'", "'health'", "'reward'", 'HealthStep', 'RewardStep', 'hasReward', 'rewardAmount', 'escapeScenario']) {
      expect(wizard).not.toContain(gone);
    }
    // A saved pet's size is a fact the report has; nothing else sends one.
    expect(wizard).toMatch(/petSize: species === 'dog' && selectedPet\?\.size \? selectedPet\.size : undefined/);
  });
});

describe('what the phone shows', () => {
  test('the flyer is on the review screen only: no strip under each question, none in the sidebar', () => {
    expect(wizard).not.toMatch(/FlyerStrip|strip=|preview=/);
    expect(screen('review')).toMatch(/<ReviewPosterCard[\s\S]*flyer=\{flyer\}/);
  });

  test('a screen answered by a tap has no footer; Back stays at the top left', () => {
    expect(screen('color')).not.toMatch(/primary=/);
    expect(screen('color')).toMatch(/onPick=\{\(value\) => \{[\s\S]*?advance\(\);/);
    expect(screen('behaviour')).toMatch(/primary=\{details\.temperament \? \{ label: 'Continue', onClick: advance \} : null\}/);
    expect(screen('behaviour')).not.toMatch(/skip=/);
    expect(wizard).toMatch(/onBack=\{history\.length > 0 \? browserBack : null\}/);
    const shell = read('components/report/WizardShell.js');
    expect(shell).toMatch(/font-semibold text-\[16px\][\s\S]{0,80}\n?[\s\S]*?Back/);
  });

  test('body text is at least 15px on the screens of the form', () => {
    const files = [
      'report/new/page.js',
      'components/report/lost/PetStep.js',
      'components/report/lost/CoatColors.js',
      'components/report/lost/BehaviourStep.js',
      'components/report/ContactFields.js',
      'components/report/OptionCardGrid.js',
      'components/report/StepScreen.js',
      'components/report/Chips.js',
      'components/report/PhotoStep.js',
      'components/report/ReviewPosterCard.js',
      'components/report/SwitchReportLink.js',
    ];
    const small = /\btext-(xs|sm)\b|text-\[(1[0-4]|[0-9])px\]|text-\[0\.\d+rem\]/;
    const found = [];
    for (const file of files) {
      read(file).split('\n').forEach((line, i) => {
        // Uppercase labels and tags ("LAST SEEN", "URGENT") are not body text.
        if (small.test(line) && !/uppercase/.test(line)) found.push(`${file}:${i + 1}: ${line.trim().slice(0, 90)}`);
      });
    }
    expect(found).toEqual([]);
    expect(read('components/report/ContactFields.js')).toMatch(/text-\[15px\] leading-snug text-midnight-600 mt-1\.5/);
    expect(read('components/report/OptionCardGrid.js')).toMatch(/text-\[15px\] text-midnight-500 mt-1 leading-snug">\{opt\.sublabel\}/);
  });

  test('the home page and the link preview no longer promise a minute', () => {
    expect(read('page.js')).not.toMatch(/about a minute/i);
    expect(read('report/layout.js')).not.toMatch(/about a minute/i);
  });
});

describe('when: the hint and the tags say the same thing', () => {
  test('only under an hour is marked urgent, as the create route does', () => {
    expect(LOST_TIME_OPTIONS.filter((o) => o.urgent).map((o) => o.value)).toEqual(['less_than_hour']);
    const create = fs.readFileSync(path.join(APP, 'api/reports/create/route.js'), 'utf8');
    expect(create).toMatch(/priority: timeElapsed === 'less_than_hour' \|\|/);
    // The hint is built from the same list.
    expect(wizard).toMatch(/const URGENT_WHEN = LOST_TIME_OPTIONS\.filter\(\(o\) => o\.urgent\)/);
    expect(screen('place')).toMatch(/\{URGENT_WHEN\.join\(', '\)\} is marked urgent\./);
  });
});

describe('where: the spot is shown and confirmed, never taken from one tap', () => {
  test('locating sets the pin and stops; the footer asks "Is this where" with one Confirm', () => {
    const place = screen('place');
    expect(place).not.toMatch(/onLocated|locate\(\)|'Use my location'/);
    expect(place).toMatch(/primary=\{location \? \{ label: 'Confirm', onClick: advance, disabled: !timeElapsed \} : null\}/);
    expect(place).toMatch(/title: `Is this where \$\{name\} got out\?`, text: 'Drag the pin to fix it\.'/);
  });

  test('the review shows a small map of the spot, one tap from changing it', () => {
    expect(screen('review')).toMatch(/<SpotMap[\s\S]*?lat=\{location\.lat\}[\s\S]*?onEdit=\{\(\) => editFromReview\('place'\)\}/);
    const html = renderToStaticMarkup(<SpotMap lat={30.2672} lng={-97.7431} label="Where Rufus got out" place="600 Congress Avenue" onEdit={() => {}} />);
    expect(html).toContain('600 Congress Avenue');
    expect(html).toContain('OpenStreetMap');
    // The tiles cover the box around the pin, and the pin's tile holds the point.
    const tiles = tilesAround(30.2672, -97.7431, 16);
    expect(tiles.length).toBeGreaterThanOrEqual(4);
    expect(tiles.some((t) => t.left <= 0 && t.left > -256 && t.top <= 0 && t.top > -256)).toBe(true);
  });
});

describe('asked right after posting', () => {
  test('the checklist after posting shows size, other colors, health and the reward first, even past its limit', () => {
    const html = renderToStaticMarkup(
      <DetailsChecklist details={normalizeDetails({ sizeUnknown: true, temperament: 'SHY' })} species="DOG" name="Rufus" onOpen={() => {}} limit={3} />
    );
    const order = ['How big is Rufus?', 'Any other colors on Rufus?', 'Does Rufus take medication or have a health condition?', 'Offering a reward?'];
    order.forEach((q) => expect(html).toContain(q));
    const at = order.map((q) => html.indexOf(q));
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).not.toContain('What is Rufus wearing?');
    expect(html).toContain('All 13 questions');
    expect(html).toContain('13 left');
    // A cat is asked whether it goes outside instead.
    const cat = renderToStaticMarkup(<DetailsChecklist details={{}} species="CAT" name="Mia" onOpen={() => {}} limit={3} />);
    expect(cat).toContain('Does Mia go outside?');
    expect(cat).not.toContain('How big is Mia?');
  });

  test('no flyer, post or caption calls a pet posted without a size "medium"', () => {
    expect(knownSize({ petSize: 'MEDIUM', details: { sizeUnknown: true } })).toBe('');
    expect(knownSize({ petSize: 'LARGE', details: normalizeDetails({ size: 'LARGE' }) })).toBe('LARGE');
    expect(knownSize({ petSize: 'GIANT', details: null })).toBe('GIANT');
    const flyer = read('lib/cascade/render/flyers/normalize.js');
    expect(flyer.match(/const sizeWord = knownSize\(caseData\)\.toLowerCase\(\);/g)).toHaveLength(2);
    expect(read('lib/cascade/aiCopy.js')).toMatch(/size: knownSize\(caseData\) \|\| null/);
  });

  test('the other colors join the main one; a cat\'s indoor answer goes on the flyer', () => {
    expect(colorWithOthers('Brown', ['White', 'Tan'])).toBe('Brown, White, Tan');
    expect(colorWithOthers('Brown, White', ['NONE'])).toBe('Brown');
    expect(colorWithOthers('Brindle', ['Brindle', 'Black'])).toBe('Brindle, Black');
    expect(normalizeDetails({ otherColors: ['White', 'Mauve', 'NONE'] }).otherColors).toEqual(['NONE']);
    expect(factsBits({ indoor: 'INDOOR' }, { species: 'CAT' })).toEqual(['Indoor cat']);
    expect(factsBits({ indoor: 'INDOOR' }, { species: 'DOG' })).toEqual([]);
  });

  test('a photo reading names the palette color it means', () => {
    expect(coatColorName('dark brown')).toBe('Dark Brown');
    expect(coatColorName('grey')).toBe('Gray');
    expect(coatColorName('spotted')).toBe('');
    expect(COAT_COLOR_NAMES).toContain('Golden');
  });
});
