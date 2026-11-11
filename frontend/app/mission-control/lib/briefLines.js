/**
 * The searcher's brief for a pet, as the lines the search screen sets
 * (app/lib/brief.js writes them; this only names them).
 *
 * The brief is written once, by the site, and read here word for word.
 * One edit: the brief names the button `"I saw Max"`, and on this screen
 * that button reads `I've seen Max`, so the name inside the sentence is
 * the name on the button. Nothing else is changed.
 */
import { briefFor } from '@/app/lib/brief';

export function searcherBrief(picture, way = 'foot') {
  const pet = picture?.pet || {};
  const name = pet.name || null;
  const lines = briefFor({ way, pet: { petName: pet.name, petSpecies: pet.species, petColor: pet.color, petBreed: pet.breed } });
  const button = (line) => (name ? String(line).split(`"I saw ${name}"`).join(`"I've seen ${name}"`) : line);
  if (way !== 'foot') return { lines: lines.map(button) };
  const [walk, look, call, never] = lines.map(button);
  // "Walk every street in the block. Your path records as you go.": the second sentence stands alone where a path is recorded.
  const records = walk.slice(walk.indexOf('. ') + 2);
  return { lines: [walk, look, call, never], records, look, call, never, neverFirst: never.slice(0, never.indexOf('.') + 1) };
}
