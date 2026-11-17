/** @jest-environment jsdom */
/**
 * A pet's page on a phone (under md). The founder, 2026-11-17: "Terrible UX
 * over the phone wow ... Phone experience should be for the phone". At 393px
 * the page was 6.2 screens long, the real place was 3,300px down, the newest
 * sighting under a 680px box, and the pinned bar wrapped "I've seen Max" onto
 * three lines and cut the owner's number.
 *
 * What is held here: the finder's box shows the owner's approach line and
 * keeps the rest one tap away; the sighting line names a street, never a
 * house; the pinned bar on a phone is one row that never wraps; the flyers
 * are folded and absent when there are none; and the page gives a visitor
 * who is not signed in the two ways to help, the owner their own page.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('@/app/components/report/recoveryKit/RecoveryKit', () => {
  const ReactLib = require('react');
  function FakeKit({ onEmptyChange }) {
    ReactLib.useEffect(() => onEmptyChange(global.__kitEmpty !== false), [onEmptyChange]);
    return <p>The kit</p>;
  }
  return { __esModule: true, default: FakeKit };
});

import { IfYouSee } from '@/app/cases/[caseNumber]/components/FinderGuide';
import { LatestSighting } from '@/app/cases/[caseNumber]/components/PhoneTop';
import RecoveryKitPanel from '@/app/cases/[caseNumber]/components/RecoveryKitPanel';

const dir = path.join(__dirname, '..', 'app', 'cases', '[caseNumber]');
const page = fs.readFileSync(path.join(dir, 'CasePageClient.js'), 'utf8');
const sticky = fs.readFileSync(path.join(dir, 'components', 'StickyActions.js'), 'utf8');
const phoneBranch = page.slice(page.indexOf('if (narrow) {'), page.indexOf('Tablets and computers'));

const guide = {
  approach: "Don't chase, call out or stare. Max will run.",
  health: 'Needs insulin twice a day.',
  lookFor: 'Blue collar.',
  facts: ['Male', 'Senior'],
  microchipped: true,
};

describe('"If you see Max" on a phone', () => {
  test('shows the owner\'s approach line, and the rest only after "More about Max"', () => {
    render(<IfYouSee name="Max" Name="Max" guide={guide} hasReward rewardAmount={500} description="Friendly golden." looks="Golden Retriever · Large" postedBy="Posted by Avery, the owner" />);
    expect(screen.getByText('If you see Max')).toBeTruthy();
    expect(screen.getByText(guide.approach)).toBeTruthy();
    const more = screen.getByRole('button', { name: 'More about Max' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('Needs insulin twice a day.').closest('[hidden]')).not.toBeNull();
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Needs insulin twice a day.').closest('[hidden]')).toBeNull();
    expect(screen.getByText('Friendly golden.')).toBeTruthy();
    expect(screen.getByText('$500 reward, paid once Max is home.')).toBeTruthy();
  });

  test('a pet with no approach line (found, home) gets "More about" alone, and nothing when there is nothing', () => {
    const { container, rerender } = render(<IfYouSee name="this dog" Name="This dog" guide={null} description="Found by the creek." />);
    expect(screen.queryByText(/If you see/)).toBeNull();
    expect(screen.getByRole('button', { name: 'More about this dog' })).toBeTruthy();
    rerender(<IfYouSee name="this dog" Name="This dog" guide={null} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('the newest sighting, one line to the map', () => {
  test('names the street and never the house number', () => {
    render(<LatestSighting s={{ sightedAt: new Date(Date.now() - 9 * 60000).toISOString(), address: '4001 Ramsey Ave, Austin, TX 78756' }} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('#pet-map');
    expect(link.textContent).toBe('Seen 9 minutes ago near Ramsey Ave');
  });

  test('a sighting sent with only a pin reads without a place', () => {
    render(<LatestSighting s={{ sightedAt: new Date(Date.now() - 5 * 60000).toISOString(), address: 'Marked on the map' }} />);
    expect(screen.getByRole('link').textContent).toBe('Seen 5 minutes ago');
  });
});

describe('the flyers on a phone', () => {
  afterEach(() => {
    delete global.__kitEmpty;
  });

  test('are one closed row that opens the kit', () => {
    global.__kitEmpty = false;
    render(<RecoveryKitPanel caseNumber="AUS-2026-0001" petName="Max" folded />);
    const row = screen.getByRole('button', { name: 'Flyers to print and share' });
    expect(row.closest('section').hidden).toBe(false);
    expect(screen.getByText('The kit').closest('[hidden]')).not.toBeNull();
    fireEvent.click(row);
    expect(screen.getByText('The kit').closest('[hidden]')).toBeNull();
  });

  test('are not shown when the pet has no kit, while the kit stays mounted to say when it has one', () => {
    global.__kitEmpty = true;
    const { container } = render(<RecoveryKitPanel caseNumber="AUS-2026-0001" petName="Max" folded />);
    expect(container.querySelector('#share-kit').hidden).toBe(true);
    expect(screen.getByText('The kit')).toBeTruthy();
  });
});

describe("the phone's page", () => {
  test('is its own branch, under md, and tablets and computers keep theirs', () => {
    expect(page).toMatch(/const narrow = useMedia\('\(max-width: 767\.98px\)'\);/);
    expect(phoneBranch.length).toBeGreaterThan(1000);
  });

  test('a visitor who is not signed in gets the two ways to help, and no job picker or force needs', () => {
    expect(phoneBranch).toMatch(/\{signedIn && !isOwner && help\}/);
    expect(phoneBranch).toMatch(/Help search/);
    expect(phoneBranch).toMatch(/href=\{missionHref\} className=\{PHONE_DARK\}/);
  });

  test('the owner\'s number shows whole: it never truncates, only the name before it does', () => {
    expect(phoneBranch).toMatch(/<span className="min-w-0 truncate">Call \{callWho\}<\/span>\s*<span className="ml-auto shrink-0 whitespace-nowrap font-bold tabular-nums">\{phone\.display\}<\/span>/);
  });

  test('the owner gets their own page: no finder\'s box, no other pets, no pinned bar', () => {
    expect(phoneBranch).toMatch(/\{!ownerView && \(\s*<IfYouSee/);
    expect(phoneBranch).toMatch(/\{!ownerView && others\}/);
    expect(phoneBranch).toMatch(/if \(status\.key === 'lost' && !isOwner\) \{\s*bar = \(/);
    expect(phoneBranch).toMatch(/<OwnerPanel \{\.\.\.ownerPanelProps\} reunitedButton=\{false\} \/>/);
    expect(phoneBranch).toMatch(/Open \$\{shortName\}'s search/);
  });

  test('the pinned bar on a phone is one row of 56px whose words cannot wrap', () => {
    expect(sticky).toMatch(/if \(compact\) \{\s*return \(\s*<div className="fixed inset-x-0 bottom-16 z-40 flex h-14 items-center/);
    expect(page).toMatch(/const BAR_PRIMARY =\s*'inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap/);
    expect(phoneBranch).toMatch(/<span className="truncate">I&apos;ve seen \{seenName\}<\/span>/);
    expect(phoneBranch.match(/<StickyActions watchId=\{ACTIONS_ID\} compact>/g)).toHaveLength(2);
  });
});
