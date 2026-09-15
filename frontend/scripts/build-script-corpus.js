#!/usr/bin/env node
/**
 * Pull real sentences for Babel out of Tatoeba.
 *
 * The corpus started as three sentences per language, written for the
 * game, saying the same three things in all 159: a cold morning, hot
 * tea, walking to work. Parallel on purpose, so the content could not
 * leak the answer. It also meant a player who came back saw the same
 * three sentences forever, which is the wrong trade once somebody plays
 * more than twice.
 *
 * Tatoeba is the answer the corpus file has named as an upgrade since
 * it was written: millions of sentences, four hundred languages, tagged
 * with the same ISO 639-3 codes this game uses, under CC-BY 2.0 FR.
 *
 * What comes back is not usable as it arrives, so this filters hard:
 *
 * - **The right script.** A sentence filed under `tam` written in Latin
 *   letters is somebody's transliteration, and in a game about
 *   recognising scripts it is a wrong answer.
 * - **No proper nouns**, which is the hard one. A city, a country or a
 *   person's name answers the round before the player has read it, and
 *   half these scripts have no capital letters to spot one by. So the
 *   filter uses frequency instead: every word in a kept sentence has to
 *   appear at least RARE_AT_LEAST times in that language's own corpus.
 *   Ordinary words are common and names are not, in any script. That is
 *   what catches the Korean sentence about going to France and the
 *   Japanese one about somebody's birthday, neither of which a capital
 *   letter rule could ever have seen.
 * - **Digits in any script**, currency and URLs go too. `\d` does not
 *   match a fullwidth six, which is how a date got through the first
 *   run of this.
 * - **It has to carry a marker.** Every sentence the game shows has to
 *   teach something on the reveal (app/lib/geo/server/markers.js), so
 *   only sentences containing one of the language's own markers are
 *   kept. That also means no new markers have to be invented for them.
 * - **Sane length**, so the round is a sentence and not a paragraph.
 *
 * The three hand-written ones stay at the front: they are known good,
 * and they are the fallback for a language Tatoeba barely covers.
 *
 * Usage (writes app/lib/geo/server/samples.js):
 *   node scripts/build-script-corpus.js            # survey only
 *   node scripts/build-script-corpus.js --write
 */

const fs = require('node:fs');
const path = require('path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const CACHE = process.env.CORPUS_CACHE || '/tmp/tatoeba';
const WANT_PER_LANGUAGE = Number(process.env.CORPUS_PER_LANGUAGE || 7);
const MIN_CHARS = 18;
const MAX_CHARS = 90;
/**
 * How often a word has to turn up in its own language's corpus before
 * it is treated as an ordinary word rather than somebody's name. Low
 * enough to keep real vocabulary in a small corpus, high enough that a
 * place or a person mentioned once or twice is gone.
 */
const RARE_AT_LEAST = 8;
/**
 * And it has to be among the commonest words its language has.
 *
 * Frequency alone strips names. It does not strip an unusual verb, and
 * Tatoeba is written by whoever felt like writing: the first German run
 * of this offered "Ich werde ihn erschiessen" for a geography game.
 * Core vocabulary only is a blunter rule and the right one here, since
 * the round wants a plain sentence rather than an interesting one, and
 * what identifies a language is its commonest words anyway.
 */
const CORE_WORDS = Number(process.env.CORPUS_CORE_WORDS || 700);

function loadModule(file, names) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/^export /gm, '');
  const box = {};
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', `${src}\nmodule.exports = {${names.join(',')}};`)(box, {});
  return box.exports;
}

const { LANGUAGES, SCRIPTS, SHARED_CHARS } = loadModule('app/lib/geo/languages.js', ['LANGUAGES', 'SCRIPTS', 'SHARED_CHARS']);
const { MARKERS } = loadModule('app/lib/geo/server/markers.js', ['MARKERS']);
const { SAMPLES } = loadModule('app/lib/geo/server/samples.js', ['SAMPLES']);

/** Is this character inside the script's own ranges? */
function inScript(ch, script) {
  const ranges = SCRIPTS[script]?.ranges || [];
  const cp = ch.codePointAt(0);
  return ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
}

/**
 * A sentence the game can show.
 *
 * The proper-noun rule is the awkward one, because a capital letter
 * means nothing in most of these scripts. For the ones with case it is
 * a capital that is not the first letter; for the ones without, the
 * check falls back to the other rules, which is why the marker
 * requirement matters so much: a sentence that carries a known feature
 * of the language is a sentence somebody wrote in that language about
 * something ordinary.
 */
function words(text) {
  return String(text || '')
    .split(/[^\p{Letter}\p{Mark}'\u2019-]+/u)
    .map((w) => w.replace(/^[-'\u2019]+|[-'\u2019]+$/g, ''))
    .filter((w) => w.length > 1);
}

function usable(text, language, common, core) {
  const s = String(text || '').trim();
  if (s.length < MIN_CHARS || s.length > MAX_CHARS) return false;
  // Any script's digits, not just 0-9: a fullwidth six is a date too.
  if (/\p{Nd}/u.test(s)) return false;
  if (/[€$£¥₹%@#_<>{}[\]|\\/*+=~^]/.test(s)) return false;
  if (/https?:|www\./i.test(s)) return false;
  // Quotes and brackets usually mean reported speech or a gloss.
  // Quotes and brackets usually mean reported speech or a gloss. The
  // CJK pair belongs here too: a line of 「...」「...」 is a dialogue.
  if (/["«»""()\u300c\u300d\u300e\u300f]/.test(s)) return false;
  // Every character, not most of them, and the same rule the corpus
  // test applies: anything outside the script and outside the shared
  // punctuation is wrong here. Spanish upside-down question marks,
  // Romanian low quotes and a Slovak non-breaking space all got through
  // a "90% of the letters" version of this.
  for (const ch of [...s]) {
    if (SHARED_CHARS.includes(ch)) continue;
    if (!inScript(ch, language.script)) return false;
  }
  if (![...s].some((ch) => /\p{Letter}/u.test(ch))) return false;
  // A capital mid-sentence is a name, in the scripts that have capitals.
  if (s.split(/\s+/).slice(1).some((w) => /^\p{Uppercase_Letter}/u.test(w))) return false;
  // And in the scripts that do not, a word nobody else in this language
  // ever uses is a name. This is the check that does the real work.
  if (common && words(s).some((w) => (common.get(w.toLowerCase()) || 0) < RARE_AT_LEAST)) return false;
  if (core && words(s).some((w) => !core.has(w.toLowerCase()))) return false;
  return true;
}

async function fetchLanguage(code) {
  fs.mkdirSync(CACHE, { recursive: true });
  const out = path.join(CACHE, `${code}.tsv`);
  if (fs.existsSync(out)) return fs.readFileSync(out, 'utf8');
  const url = `https://downloads.tatoeba.org/exports/per_language/${code}/${code}_sentences.tsv.bz2`;
  const bz = path.join(CACHE, `${code}.tsv.bz2`);
  try {
    execFileSync('curl', ['-sS', '--max-time', '60', '-o', bz, url], { stdio: 'pipe' });
    execFileSync('bunzip2', ['-f', bz], { stdio: 'pipe' });
    return fs.readFileSync(out, 'utf8');
  } catch {
    return '';
  }
}

/**
 * The words a sentence may not contain: every language's name and
 * endonym, and every word of every region name. Lifted from the corpus
 * test (__tests__/geo/script.test.js) rather than reinvented, so the
 * filter and the check cannot drift apart.
 */
const BANNED = new Set();
for (const language of LANGUAGES) {
  BANNED.add(language.name.toLowerCase());
  BANNED.add(language.endonym.toLowerCase());
  for (const region of language.regions) {
    for (const word of region.name.split(/\s+/)) {
      if (word.length >= 4 && word[0] === word[0].toUpperCase()) BANNED.add(word.toLowerCase());
    }
  }
}

/**
 * Tatoeba's cast. Nearly every sentence in the project is about Tom,
 * and often Mary, in every language it has: they are the stock names
 * its contributors reach for. Frequency cannot catch them, because they
 * are the commonest words in the corpus rather than rare ones, and the
 * capital rule cannot either when the name opens the sentence. So they
 * are listed.
 */
const STOCK_NAMES = /\b(Tom|Tomo?m|Mary|Maria|Marie|John|Bob|Ken|Jim|Alice|Emily|Bill|Mike|Nancy|Jack|Betty)\b/i;

function namesSomething(text) {
  if (STOCK_NAMES.test(text)) return true;
  const seen = new Set(
    text
      .toLowerCase()
      .split(/[^\p{Letter}\p{Mark}]+/u)
      .filter(Boolean)
  );
  for (const term of BANNED) {
    if (term.includes(' ') ? text.toLowerCase().includes(term) : seen.has(term)) return true;
  }
  return false;
}

(async () => {
  const write = process.argv.includes('--write');
  const report = [];
  const added = {};

  for (const language of LANGUAGES) {
    const raw = await fetchLanguage(language.code);
    const markers = (MARKERS[language.code] || []).map((m) => m.text);
    const rivalMarkers = LANGUAGES.filter((l) => l.script === language.script && l.code !== language.code)
      .flatMap((l) => (MARKERS[l.code] || []).map((m) => m.text))
      .filter((m) => !markers.includes(m));
    const existing = new Set(SAMPLES[language.code] || []);
    const picks = [];
    if (raw) {
      const lines = raw.split('\n');
      // What this language's own writers say often. Built from the whole
      // file before anything is picked, so a name that appears in one
      // sentence is rare by definition.
      const common = new Map();
      for (const line of lines) {
        const text = line.split('\t')[2];
        if (!text) continue;
        for (const w of words(text)) {
          const k = w.toLowerCase();
          common.set(k, (common.get(k) || 0) + 1);
        }
      }
      const core = new Set(
        [...common.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, CORE_WORDS)
          .map(([w]) => w)
      );
      for (const line of lines) {
        const text = line.split('\t')[2];
        if (!text || existing.has(text.trim())) continue;
        const s = text.trim();
        if (!usable(s, language, common, core)) continue;
        // It has to teach something on the reveal.
        if (markers.length && !markers.some((m) => s.includes(m))) continue;
        // And it must not carry a rival's marker. A marker is a feature
        // that belongs to one language in its script; a Lithuanian
        // sentence containing Polish's ę makes that false, and the
        // markers test says so.
        if (rivalMarkers.some((m) => s.includes(m))) continue;
        // Tatoeba's cast is called Tom and Mary, and a name in a
        // sentence answers the round. The corpus test's own rule.
        if (namesSomething(s)) continue;
        if (picks.includes(s)) continue;
        picks.push(s);
        if (picks.length >= WANT_PER_LANGUAGE) break;
      }
    }
    added[language.code] = picks;
    report.push({ code: language.code, name: language.name, had: (SAMPLES[language.code] || []).length, got: picks.length });
  }

  const none = report.filter((r) => !r.got);
  const total = report.reduce((a, r) => a + r.got, 0);
  console.log(`languages: ${report.length}  new sentences: ${total}  languages with none: ${none.length}`);
  console.log('no new sentences for:', none.map((r) => r.code).join(' ') || '(none)');
  const top = report.slice().sort((a, b) => b.got - a.got).slice(0, 8);
  console.log('best covered:', top.map((r) => `${r.code}:${r.got}`).join(' '));

  if (!write) return;
  fs.writeFileSync('/tmp/corpus-additions.json', JSON.stringify(added, null, 1));
  console.log('wrote /tmp/corpus-additions.json');
})();
