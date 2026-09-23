/**
 * A pasted play link says which game it is. probablyearth.com/daily, a
 * mode's own link and "Challenge a friend" all previewed as plain
 * "Probably Earth" with the site's description.
 */
import { playLinkMetadata } from '@/app/lib/geo/playMeta';

test.each([
  [{ mode: 'daily' }, "Today's daily", /same places for everyone today/],
  [{ mode: 'ranked' }, 'Ranked', /60 seconds each/],
  [{ mode: 'cup' }, 'Weekly cup', /one entry a week/],
  [{ mode: 'streak' }, 'Country streak', /One wrong answer ends the run/],
  [{ mode: 'balanced', seed: 'abc123' }, 'Same places, your turn', /compare scores/],
  [{}, 'Play Street', /pin where you think it is/],
])('%j previews as %s', (params, title, description) => {
  const meta = playLinkMetadata(params);
  expect(meta.openGraph.title).toBe(title);
  expect(meta.title).toBe(`${title} | Probably Earth`);
  expect(meta.description).toMatch(description);
  // A live game is never indexed; robots.txt lets the card be drawn.
  expect(JSON.stringify(meta.robots)).toMatch(/"index":false/);
});

test('reads URLSearchParams as well as the object Next passes', () => {
  expect(playLinkMetadata(new URLSearchParams('mode=daily')).openGraph.title).toBe("Today's daily");
  expect(playLinkMetadata({ mode: ['cup', 'daily'] }).openGraph.title).toBe('Weekly cup');
});

test('the play page is a server page with its own metadata', () => {
  const fs = require('fs');
  const path = require('path');
  const page = fs.readFileSync(path.resolve(__dirname, '../../app/geo/play/page.js'), 'utf8');
  expect(page).not.toMatch(/^'use client'/m);
  expect(page).toContain('export async function generateMetadata');
});
