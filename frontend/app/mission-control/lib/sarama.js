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
 * To the owner she is calm and does not cheer: their pet is missing. She
 * never tells them nothing is waiting: she says the next thing to do
 * (founder, 2026-11-13, on "Nothing is waiting for you": "What does this
 * mean? so confusing. My pet is waiting for me, he is still lost ... make
 * the text actually useful and teaches people where to look").
 */

export const SARAMA = {
  /**
   * To someone who has opened the link: who she is and how long the pet has been gone. What follows it on the card
   * is the brief, word for word: their own home first, and what to do on seeing the pet.
   */
  hello: (name, missing = '') => (missing ? `I'm Sarama, and I'm looking for ${name}, missing ${missing}. Here is how to help right now.` : `I'm Sarama, and I'm looking for ${name}. Here is how to help right now.`),
  /** Back again, with prints already on this search. */
  back: (name) => `Good to see you again. ${name} still needs us.`,
  join: () => 'Tell me your name and read the rules. Then I will give you some ground.',
  training: () => 'Seven things I want you to know before we go out.',
  /** Someone the owner asked by name. */
  asked: (owner) => `${owner || 'The owner'} asked for you by name.`,
  /** An area searched. */
  done: (paws) => `Well done. That is ${paws} paw prints on this search.`,
  /** To the person running the search, when nothing is waiting on a decision: what to do next. */
  next: (title) => `Next: ${title}.`,
  nobodyOut: (name) => `Nobody is searching right now. Text the link to neighbors so more people are watching for ${name}.`,
  nextArea: (area) => `When a neighbor offers to search, they are sent to ${area} first.`,
};
