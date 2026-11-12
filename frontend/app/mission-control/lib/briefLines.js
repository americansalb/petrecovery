/**
 * The searcher's brief for a pet, as the lines the search screen sets
 * (app/lib/brief.js writes them; this only names them).
 *
 * The brief is written once, by the site, and read here word for word.
 */
import { briefFor, onSeeing } from '@/app/lib/brief';

export function searcherBrief(picture, way = 'foot') {
  const pet = picture?.pet || {};
  const of = { petName: pet.name, petSpecies: pet.species, petColor: pet.color, petBreed: pet.breed };
  const lines = briefFor({ way, pet: of });
  if (way !== 'foot') return { lines };
  const [walk, look, call, never] = lines;
  // "Walk every street in the block. Your path records as you go.": the second sentence stands alone where a path is recorded.
  const records = walk.slice(walk.indexOf('. ') + 2);
  // The first sentence of the last line is the brief's own: a name with a full stop in it would break a cut.
  return { lines: [walk, look, call, never], records, look, call, never, neverFirst: onSeeing(of) };
}
