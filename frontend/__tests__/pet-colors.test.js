/**
 * One meaning per pet color, on every page (app/lib/petColors.js).
 *
 * Before, a found pet was blue on the Lost & Found map but green on the
 * found-pet form and the Report menu, the green that meant "home" on the
 * map; a sighting was amber on the map and blue on the pet's page. Green
 * now always carries a check mark, which is what tells home from lost for
 * someone with red-green colorblindness.
 */

import fs from 'fs';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { PET_COLOR } from '@/app/lib/petColors';
import { caseStatusColors } from '@/app/lib/caseStatus';
import { caseStatus } from '@/app/lib/caseLabels';
import { WIZARD_THEMES } from '@/app/components/report/wizardTheme';
import PetStatusDot from '@/app/components/PetStatusDot';

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('each pet color means one thing', () => {
  const { lost, found, home, seen } = PET_COLOR;
  expect(new Set([lost, found, home, seen]).size).toBe(4);
});

test('the found-pet form is blue, not the green that means home', () => {
  const found = WIZARD_THEMES.found;
  expect(found.mapHex).toBe(PET_COLOR.found);
  expect(WIZARD_THEMES.lost.mapHex).toBe(PET_COLOR.lost);
  expect(Object.values(found).join(' ')).not.toMatch(/emerald|green|teal/);
});

test('the Report menu offers a found pet in blue', () => {
  const nav = read('app/components/Navigation.js');
  const foundLinks = nav.split('href="/report/found"').slice(1).map((after) => after.slice(0, 700));
  expect(foundLinks.length).toBeGreaterThan(0);
  for (const block of foundLinks) {
    expect(block).not.toMatch(/green-|emerald-/);
    expect(block).toMatch(/sky-/);
  }
});

test('maps take their pet colors from the one file', () => {
  for (const file of ['app/lost-and-found/BrowseMap.js', 'app/cases/[caseNumber]/components/LastSeenMap.js']) {
    const source = read(file);
    expect(source).toMatch(/from '@\/app\/lib\/petColors'/);
    expect(source).not.toMatch(/#ef4444|#0ea5e9|#10b981|#f59e0b/i);
  }
});

test('status badges: missing is red, a sighting orange, reunited green', () => {
  expect(caseStatusColors('ACTIVE').border).toBe(PET_COLOR.lost);
  expect(caseStatusColors('IN_PROGRESS').border).toBe(PET_COLOR.lost);
  expect(caseStatusColors('SIGHTING_REPORTED').border).toBe(PET_COLOR.seen);
  expect(caseStatusColors('REUNITED').border).toBe(PET_COLOR.home);
  expect(caseStatus({ status: 'REUNITED' }).label).toBe('Reunited');
});

test('a pet that is home is marked with a check, not only with green', () => {
  const home = renderToStaticMarkup(<PetStatusDot status="home" />);
  expect(home).toMatch(/<svg/);
  expect(home).toMatch(/bg-emerald-600/);

  const lost = renderToStaticMarkup(<PetStatusDot status="lost" />);
  expect(lost).not.toMatch(/<svg/);
  expect(lost).toMatch(/bg-red-600/);
});
