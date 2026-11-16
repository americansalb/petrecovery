/** @jest-environment jsdom */
/**
 * The pet's page, for its owner: "How can you help Pip? ... Give me a job"
 * is for helpers. Testing found the owner offered a helper's job on their
 * own missing pet; the owner has their own tools (OwnerPanel) and is not
 * asked how they can help find their own dog.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';

jest.mock('next/navigation', () => ({ __esModule: true, useRouter: () => ({ push: jest.fn() }) }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href, className }) => <a href={href} className={className}>{children}</a> }));
jest.mock('@/components/WaiverModal', () => ({ __esModule: true, default: () => null }));

import HowToHelp from '@/app/cases/[caseNumber]/components/HowToHelp';

const props = { name: 'Pip', caseId: 'case-pip', caseNumber: 'AUS-2026-0042', signedIn: true, lost: true, room: null, searchHref: '/mission-control?mission=AUS-2026-0042', ways: [], onJoin: jest.fn(), onChanged: jest.fn() };

test('a helper is asked how they can help, and offered a job', () => {
  render(<HowToHelp {...props} />);
  expect(screen.getByText('How can you help Pip?')).toBeTruthy();
  expect(screen.getByText('Give me a job')).toBeTruthy();
});

test('the owner is not offered a helper\'s job on their own pet, and keeps the way into the search', () => {
  render(<HowToHelp {...props} isOwner />);
  expect(screen.queryByText('How can you help Pip?')).toBeNull();
  expect(screen.queryByText('Give me a job')).toBeNull();
  expect(screen.getByText('Search on the map').closest('a').getAttribute('href')).toBe('/mission-control?mission=AUS-2026-0042');
});

test('the pet\'s page says who the owner is when it draws the help section', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'cases', '[caseNumber]', 'CasePageClient.js'), 'utf8');
  const help = page.slice(page.indexOf('<HowToHelp'), page.indexOf('/>', page.indexOf('<HowToHelp')));
  expect(help).toMatch(/isOwner=\{isOwner\}/);
});
