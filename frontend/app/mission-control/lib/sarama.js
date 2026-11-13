/**
 * What Sarama says. Sarama is the site's search dog and its guide: on the
 * search screen she is the one voice that speaks as "I" (founder,
 * 2026-11-13: "our mascot Sarama, beautifully guiding everyone").
 *
 * Her lines are here and nowhere else, so they can be read in one sitting.
 * How she talks: short, warm and plain, one or two sentences, the way a
 * good team lead talks to someone who has just turned up to help. No puns
 * and no baby talk. She never says a search will work, never hurries
 * anyone, and never tells anyone to stop.
 *
 * How to search is not hers to say: that is the brief and the training,
 * word for word (app/lib/brief.js, app/lib/safetyRules.js).
 *
 * To the owner she is calm and does not cheer: their pet is missing.
 */

const people = (n) => (n === 1 ? '1 person is' : `${n} people are`);

export const SARAMA = {
  /** To someone who has opened the link and not joined. */
  hello: (name, out = 0) => (out > 0 ? `I'm Sarama. ${people(out)} out looking for ${name} right now. Come and look with us.` : `I'm Sarama. ${name} is still missing, and nobody is out looking right now. Come and look with me.`),
  /** Back again, with prints already on this search. */
  back: (name) => `Good to see you again. ${name} still needs us.`,
  join: () => 'Tell me your name and read the rules. Then I will give you some ground.',
  training: () => 'Seven things I want you to know before we go out.',
  /** Handing someone their area. */
  area: () => 'This ground is yours. Take your time with it.',
  /** Someone the owner asked by name. */
  asked: (owner) => `${owner || 'The owner'} asked for you by name.`,
  /** An area searched. */
  done: (paws) => `Well done. That is ${paws} paw prints on this search.`,
  debriefed: () => 'Thank you. One more paw print for telling me how it went.',
  /** To the person running the search, on the desk. */
  owner: (name) => `I am on ${name}'s search with you. Here is what needs you first.`,
};
