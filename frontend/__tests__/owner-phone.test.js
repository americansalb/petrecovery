/** @jest-environment jsdom */
/**
 * An owner on a phone (founder, 2026-11-17: "Terrible UX over the phone
 * wow"; "Phone experience should be for the phone"). Found at 393x852 and
 * 375x667, and held here so it does not come back:
 *
 *   - the page after posting a lost pet was nearly four screens long, with
 *     no way out but a button about 2,400px down;
 *   - "My pet is lost" on the home page jumped 62px down about 1.7 s after
 *     load, when the count of pets waiting arrived above it;
 *   - the account menu named "My pets" twice and the person's own rescue
 *     force twice.
 *
 * The owner's search card and the dashboard are held in
 * search-screen-rules.test.js and dashboard-own-reports.test.js.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('next-auth/react', () => ({ __esModule: true, useSession: () => ({ data: { user: { id: 'u-mike' } }, status: 'authenticated' }) }));
jest.mock('next/navigation', () => ({ __esModule: true, useRouter: () => ({ push: jest.fn() }) }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href, className }) => <a href={href} className={className}>{children}</a> }));

import AccountModeSwitcher from '@/app/components/AccountModeSwitcher';

const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('the page after posting', () => {
  const screen = read('app/components/report/SuccessScreen.js');

  test('the way out is pinned at the top: the search first, the pet\'s page beside it', () => {
    const exits = screen.slice(screen.indexOf('function Exits('), screen.indexOf('/** The link to the pet\'s page'));
    expect(exits).toMatch(/href=\{`\/mission-control\?mission=\$\{encodeURIComponent\(caseNumber\)\}`\} className=\{`\$\{FLASH\}/);
    expect(exits).toMatch(/Go to \{name\}&apos;s search/);
    expect(exits).toMatch(/Open \{name\}&apos;s page/);
    // Outside the part that scrolls, so it never scrolls away.
    const page = screen.slice(screen.indexOf('<Exits lost={lost}'));
    expect(page.indexOf('<Exits')).toBeLessThan(page.indexOf('overflow-y-auto'));
    expect(screen).toMatch(/<nav aria-label="Where to go from here" className="shrink-0 /);
  });

  test('sharing the link is the first card, and the rest is folded under one card that names it', () => {
    const lost = screen.slice(screen.indexOf('function LostBody('), screen.indexOf('function FoundBody('));
    const first = lost.indexOf('<ShareCard');
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeLessThan(lost.indexOf('<FoundNearby'));
    expect(first).toBeLessThan(lost.indexOf('<More items={more}>'));
    // Everything else is inside the fold.
    const fold = lost.slice(lost.indexOf('<More items={more}>'), lost.indexOf('</More>'));
    for (const part of ['title="Post it where neighbors look"', 'title="Print the flyer and put it up"', 'title="Call the shelters near the spot today"', '<DetailsHub', '<ScamNote']) {
      expect(fold).toContain(part);
    }
    expect(screen).not.toMatch(/Do this now/);
  });

  test('one yellow button on the screen, and nothing to tap smaller than a finger', () => {
    const lost = screen.slice(screen.indexOf('function LostBody('), screen.indexOf('function FoundBody('));
    expect(lost).not.toMatch(/\$\{FLASH\}|shareIsPrimary/);
    // "See the force" was 96 by 19 px.
    expect(screen).toMatch(/className="inline-flex min-h-\[44px\] items-center align-middle font-semibold text-white underline[^"]*">\s*See the force/);
    expect(screen).toMatch(/aria-expanded=\{open\} className="flex min-h-\[44px\]/);
  });
});

describe('the home page holds still', () => {
  test('the count of pets waiting has its line from the first paint', () => {
    const home = read('app/page.js');
    const hero = home.slice(home.indexOf('function Hero('));
    const slot = hero.indexOf('<div className="h-9 md:h-10 flex items-center">');
    expect(slot).toBeGreaterThan(-1);
    // The pill is inside the held line, and the line is not itself behind the count.
    expect(slot).toBeLessThan(hero.indexOf('{openCount > 0 && ('));
    expect(hero.slice(0, slot)).not.toMatch(/\{openCount > 0 && \(\s*$/);
    expect(hero).toMatch(/className="inline-flex h-9 md:h-10 items-center[^"]*whitespace-nowrap/);
  });
});

describe('the account menu names each place once', () => {
  const nav = read('app/components/Navigation.js');
  const switcher = read('app/components/AccountModeSwitcher.js');

  test('a mode that goes to a page the menu already links to is left out', () => {
    expect(switcher).toMatch(/const others = modes\.filter\(\(m\) => m\.id !== current && !listed\.includes\(m\.href\)\);/);
    // The desktop menu has its own "My Pets"; the phone's also lists the person's forces.
    expect(nav).toMatch(/<AccountModeSwitcher onNavigate=\{\(\) => setActiveDropdown\(null\)\} listed=\{\['\/pets'\]\} \/>/);
    expect(nav).toMatch(/<AccountModeSwitcher onNavigate=\{\(\) => setMobileMenuOpen\(false\)\} listed=\{menuListed\} \/>/);
    expect(nav).toMatch(/const menuListed = session \? \['\/pets', \.\.\.userSquads\.slice\(0, 5\)\.map\(\(squad\) => `\/rescue-forces\/\$\{squad\.id\}`\)\] : \[\];/);
    // The forces the phone's menu lists are the same five it links to.
    expect(nav).toMatch(/\{userSquads\.slice\(0, 5\)\.map\(squad => \(/);
  });

  test('rendered: the menu shows the shelter door and no second "My pets" or second force', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        modes: [
          { id: 'owner', label: 'My pets', detail: 'Your own animals', href: '/pets' },
          { id: 'searcher', label: 'Austin Rescue Force', detail: 'Your rescue force', href: '/rescue-forces/f1' },
        ],
      }),
    }));
    render(<AccountModeSwitcher listed={['/pets', '/rescue-forces/f1', '/rescue-forces/f2']} />);
    expect(await screen.findByText('Shelter Portal')).toBeTruthy();
    expect(screen.queryByText('My pets')).toBeNull();
    expect(screen.queryByText('Austin Rescue Force')).toBeNull();
    delete global.fetch;
  });
});
