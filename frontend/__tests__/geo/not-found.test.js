/** @jest-environment jsdom */

/**
 * A dead end in the game has to land in the game.
 *
 * Live, probablyearth.com/geo/nowhere returned the pet site's 404: a paw
 * print, ReunitePets branding, and links to Lost & Found and Report Pet,
 * shown to somebody who mistyped a room link on a geography game. The
 * game is a site of its own (docs/GEO.md); app/geo/not-found.js is the
 * segment's own handler, and it inherits the game's header and footer
 * from the layout above it.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import GeoNotFound from '@/app/geo/not-found';

const fs = require('fs');
const path = require('path');

test('the game owns its own dead end', () => {
  render(<GeoNotFound />);
  expect(screen.getByRole('heading', { name: /not here/i })).toBeInTheDocument();
});

test('it offers the way back into the game, at a touch size', () => {
  render(<GeoNotFound />);
  const play = screen.getByRole('link', { name: 'Play' });
  expect(play).toHaveAttribute('href', '/geo');
  expect(play.className).toContain('min-h-[44px]');
  expect(screen.getByRole('link', { name: 'Multiplayer' })).toHaveAttribute('href', '/geo/rooms');
});

test('it carries none of the pet site', () => {
  const { container } = render(<GeoNotFound />);
  expect(container.textContent).not.toMatch(/ReunitePets|Lost & Found|Report Pet|pet/i);
});

test('the file exists where Next looks for it', () => {
  // A not-found at any other path silently does nothing.
  expect(fs.existsSync(path.resolve(__dirname, '../..', 'app/geo/not-found.js'))).toBe(true);
});
