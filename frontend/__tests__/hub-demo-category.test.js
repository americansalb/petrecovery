/**
 * The local demo's Hub thread is on /hub.
 *
 * prisma/seed-sample-data.js made the category 'lost-pet-help', but /hub
 * (app/hub/page.js) lists 'lost-pet-support', the slug the production
 * seeds use, so the demo thread was invisible there and the gallery sweep
 * captured an empty category page.
 */
import fs from 'fs';
import path from 'path';

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

/** The category slugs the Hub's front page lists, from its sections. */
function hubSlugs() {
  const page = read('app/hub/page.js');
  return [...page.matchAll(/slugs: \[([^\]]+)\]/g)].flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((s) => s[1]));
}

test('every category the sample seed makes is one the Hub lists, and the demo thread is in the lost-pet one', () => {
  const seed = read('prisma/seed-sample-data.js');
  const made = [...seed.matchAll(/\['[^']+', '([a-z-]+)', '[^']*', '[^']*', '#[0-9a-f]{6}'\]/g)].map((m) => m[1]);
  expect(made).toEqual(['lost-pet-support', 'success-stories', 'general']);
  for (const slug of made) expect(hubSlugs()).toContain(slug);
  expect(seed).toMatch(/categoryId: forumCats\['lost-pet-support'\]\.id,/);
  expect(seed).not.toMatch(/'lost-pet-help'/);
});

test('the production seeds and the sample seed agree on the slug', () => {
  expect(read('prisma/seed-rescue-hub.js')).toMatch(/slug: 'lost-pet-support'/);
  expect(read('prisma/seed-forum-content.js')).toMatch(/category: 'lost-pet-support'/);
});

test('the gallery sweep captures the category the demo thread is in', () => {
  const sweep = read('scripts/gallery-sweep.js');
  expect(sweep).toMatch(/\['pub-23-hub-category', '\/hub\/c\/lost-pet-support'\]/);
  expect(sweep).not.toMatch(/lost-pet-help/);
});
