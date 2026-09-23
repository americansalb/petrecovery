/**
 * The scripts the game can actually draw.
 *
 * A language game that renders tofu boxes is not a hard round, it is a
 * broken one, and it breaks worst on cheap Android hardware in exactly
 * the places this mode exists to represent (docs/PROBABLY_EARTH_STRATEGY.md,
 * bet 5a: "test Indic, Myanmar and Ethiopic rendering early"). So the
 * font for every non-Latin script in the corpus ships with the page
 * rather than being hoped for on the device.
 *
 * Latin, Cyrillic and Greek are already covered by Inter in the root
 * layout. Han, Hangul and Kana are not bundled: those families are
 * several megabytes each and system coverage for them is close to
 * universal, so they fall back to the device and the tofu check in
 * ScriptSample tells the player if that bet was wrong on their machine.
 *
 * Every family is loaded with display: 'swap' and its own subset, so a
 * round shows its text immediately in whatever the device has and
 * upgrades when the real face arrives.
 *
 * None of them is preloaded. next/font preloads every family a route's
 * modules declare, whether or not the page draws a word in it, so every
 * game page, the front door and the rankings included, asked for all
 * twenty-eight at once: 2.6 MB of fonts on a phone's first visit, one of
 * them 714 KB, ahead of the game's own code. A family's @font-face still
 * loads the moment a sentence in its script is on screen, which is the
 * only time it is needed.
 */

import {
  Noto_Sans_Adlam,
  Noto_Sans_Arabic,
  Noto_Sans_Armenian,
  Noto_Sans_Bengali,
  Noto_Sans_Canadian_Aboriginal,
  Noto_Sans_Cherokee,
  Noto_Sans_Devanagari,
  Noto_Sans_Ethiopic,
  Noto_Sans_Georgian,
  Noto_Sans_Gujarati,
  Noto_Sans_Gurmukhi,
  Noto_Sans_Hebrew,
  Noto_Sans_Kannada,
  Noto_Sans_Khmer,
  Noto_Sans_Lao,
  Noto_Sans_Malayalam,
  Noto_Sans_Meetei_Mayek,
  Noto_Sans_Myanmar,
  Noto_Sans_NKo,
  Noto_Sans_Ol_Chiki,
  Noto_Sans_Oriya,
  Noto_Sans_Sinhala,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
  Noto_Sans_Thaana,
  Noto_Sans_Thai,
  Noto_Sans_Tifinagh,
  Noto_Serif_Tibetan,
} from 'next/font/google';

// next/font reads these calls at build time, so every argument has to
// be a literal here: no shared options object, no spread, no loop.
const arabic = Noto_Sans_Arabic({ display: 'swap', preload: false, weight: 'variable', subsets: ['arabic'], variable: '--font-s-arab' });
const armenian = Noto_Sans_Armenian({ display: 'swap', preload: false, weight: 'variable', subsets: ['armenian'], variable: '--font-s-armn' });
const bengali = Noto_Sans_Bengali({ display: 'swap', preload: false, weight: 'variable', subsets: ['bengali'], variable: '--font-s-beng' });
const devanagari = Noto_Sans_Devanagari({ display: 'swap', preload: false, weight: 'variable', subsets: ['devanagari'], variable: '--font-s-deva' });
const ethiopic = Noto_Sans_Ethiopic({ display: 'swap', preload: false, weight: 'variable', subsets: ['ethiopic'], variable: '--font-s-ethi' });
const georgian = Noto_Sans_Georgian({ display: 'swap', preload: false, weight: 'variable', subsets: ['georgian'], variable: '--font-s-geor' });
const gujarati = Noto_Sans_Gujarati({ display: 'swap', preload: false, weight: 'variable', subsets: ['gujarati'], variable: '--font-s-gujr' });
const gurmukhi = Noto_Sans_Gurmukhi({ display: 'swap', preload: false, weight: 'variable', subsets: ['gurmukhi'], variable: '--font-s-guru' });
const hebrew = Noto_Sans_Hebrew({ display: 'swap', preload: false, weight: 'variable', subsets: ['hebrew'], variable: '--font-s-hebr' });
const kannada = Noto_Sans_Kannada({ display: 'swap', preload: false, weight: 'variable', subsets: ['kannada'], variable: '--font-s-knda' });
const khmer = Noto_Sans_Khmer({ display: 'swap', preload: false, weight: 'variable', subsets: ['khmer'], variable: '--font-s-khmr' });
const lao = Noto_Sans_Lao({ display: 'swap', preload: false, weight: 'variable', subsets: ['lao'], variable: '--font-s-laoo' });
const malayalam = Noto_Sans_Malayalam({ display: 'swap', preload: false, weight: 'variable', subsets: ['malayalam'], variable: '--font-s-mlym' });
const oriya = Noto_Sans_Oriya({ display: 'swap', preload: false, weight: 'variable', subsets: ['oriya'], variable: '--font-s-orya' });
const sinhala = Noto_Sans_Sinhala({ display: 'swap', preload: false, weight: 'variable', subsets: ['sinhala'], variable: '--font-s-sinh' });
const tamil = Noto_Sans_Tamil({ display: 'swap', preload: false, weight: 'variable', subsets: ['tamil'], variable: '--font-s-taml' });
const telugu = Noto_Sans_Telugu({ display: 'swap', preload: false, weight: 'variable', subsets: ['telugu'], variable: '--font-s-telu' });
const thai = Noto_Sans_Thai({ display: 'swap', preload: false, weight: 'variable', subsets: ['thai'], variable: '--font-s-thai' });
// Google does not publish these three as variable fonts.
const myanmar = Noto_Sans_Myanmar({ display: 'swap', preload: false, weight: ['400', '600'], subsets: ['myanmar'], variable: '--font-s-mymr' });
const nko = Noto_Sans_NKo({ display: 'swap', preload: false, weight: ['400'], subsets: ['nko'], variable: '--font-s-nkoo' });
const tifinagh = Noto_Sans_Tifinagh({ display: 'swap', preload: false, weight: ['400'], subsets: ['tifinagh'], variable: '--font-s-tfng' });

// Scripts a phone almost certainly does not have. Thaana, Tibetan, Ol
// Chiki, Meetei Mayek, Cherokee, Canadian syllabics, N'Ko, Adlam and
// Tifinagh are each written for a handful of languages, and a device
// that has never needed one will draw empty boxes for the whole round.
// Bundling them is the difference between a hard round and a broken one.
const adlam = Noto_Sans_Adlam({ display: 'swap', preload: false, weight: 'variable', subsets: ['adlam'], variable: '--font-s-adlm' });
const canadian = Noto_Sans_Canadian_Aboriginal({ display: 'swap', preload: false, weight: 'variable', subsets: ['canadian-aboriginal'], variable: '--font-s-cans' });
const cherokee = Noto_Sans_Cherokee({ display: 'swap', preload: false, weight: 'variable', subsets: ['cherokee'], variable: '--font-s-cher' });
const meetei = Noto_Sans_Meetei_Mayek({ display: 'swap', preload: false, weight: 'variable', subsets: ['meetei-mayek'], variable: '--font-s-mtei' });
const olchiki = Noto_Sans_Ol_Chiki({ display: 'swap', preload: false, weight: 'variable', subsets: ['ol-chiki'], variable: '--font-s-olck' });
const thaana = Noto_Sans_Thaana({ display: 'swap', preload: false, weight: 'variable', subsets: ['thaana'], variable: '--font-s-thaa' });
const tibetan = Noto_Serif_Tibetan({ display: 'swap', preload: false, weight: 'variable', subsets: ['tibetan'], variable: '--font-s-tibt' });

export const scriptShowcaseFonts = [devanagari, tamil, ethiopic].map((font) => font.variable).join(' ');

/** Put on the wrapper of any subtree that renders sample text. */
export const scriptFontClasses = [
  adlam,
  arabic,
  armenian,
  bengali,
  canadian,
  cherokee,
  devanagari,
  ethiopic,
  georgian,
  gujarati,
  gurmukhi,
  hebrew,
  kannada,
  khmer,
  lao,
  malayalam,
  meetei,
  myanmar,
  nko,
  olchiki,
  oriya,
  sinhala,
  tamil,
  telugu,
  thaana,
  thai,
  tibetan,
  tifinagh,
]
  .map((font) => font.variable)
  .join(' ');

/**
 * The font stack for one script id (app/lib/geo/languages.js). Bundled
 * families first, then the names a desktop or phone is likely to have,
 * then the generic. Scripts with no entry fall through to the body font,
 * which is what Latin, Cyrillic and Greek want anyway.
 */
const STACKS = {
  arab: 'var(--font-s-arab), "Noto Naskh Arabic", "Geeza Pro", "Segoe UI", sans-serif',
  armn: 'var(--font-s-armn), "Noto Sans Armenian", "Mshtakan", sans-serif',
  beng: 'var(--font-s-beng), "Noto Sans Bengali", "Nirmala UI", "Vrinda", sans-serif',
  deva: 'var(--font-s-deva), "Noto Sans Devanagari", "Nirmala UI", "Mangal", sans-serif',
  ethi: 'var(--font-s-ethi), "Noto Sans Ethiopic", "Kefa", "Nyala", sans-serif',
  geor: 'var(--font-s-geor), "Noto Sans Georgian", "Sylfaen", sans-serif',
  gujr: 'var(--font-s-gujr), "Noto Sans Gujarati", "Nirmala UI", "Shruti", sans-serif',
  guru: 'var(--font-s-guru), "Noto Sans Gurmukhi", "Nirmala UI", "Raavi", sans-serif',
  hebr: 'var(--font-s-hebr), "Noto Sans Hebrew", "Arial Hebrew", sans-serif',
  knda: 'var(--font-s-knda), "Noto Sans Kannada", "Nirmala UI", "Tunga", sans-serif',
  khmr: 'var(--font-s-khmr), "Noto Sans Khmer", "Khmer Sangam MN", sans-serif',
  laoo: 'var(--font-s-laoo), "Noto Sans Lao", "Lao Sangam MN", sans-serif',
  mlym: 'var(--font-s-mlym), "Noto Sans Malayalam", "Nirmala UI", "Kartika", sans-serif',
  mymr: 'var(--font-s-mymr), "Noto Sans Myanmar", "Myanmar MN", "Padauk", sans-serif',
  orya: 'var(--font-s-orya), "Noto Sans Oriya", "Nirmala UI", "Kalinga", sans-serif',
  sinh: 'var(--font-s-sinh), "Noto Sans Sinhala", "Nirmala UI", "Iskoola Pota", sans-serif',
  taml: 'var(--font-s-taml), "Noto Sans Tamil", "Nirmala UI", "Latha", sans-serif',
  telu: 'var(--font-s-telu), "Noto Sans Telugu", "Nirmala UI", "Gautami", sans-serif',
  thai: 'var(--font-s-thai), "Noto Sans Thai", "Thonburi", "Leelawadee UI", sans-serif',
  adlm: 'var(--font-s-adlm), "Noto Sans Adlam", sans-serif',
  cans: 'var(--font-s-cans), "Noto Sans Canadian Aboriginal", "Euphemia UCAS", "Euphemia", sans-serif',
  cher: 'var(--font-s-cher), "Noto Sans Cherokee", "Plantagenet Cherokee", sans-serif',
  mtei: 'var(--font-s-mtei), "Noto Sans Meetei Mayek", sans-serif',
  nkoo: 'var(--font-s-nkoo), "Noto Sans NKo", sans-serif',
  olck: 'var(--font-s-olck), "Noto Sans Ol Chiki", sans-serif',
  thaa: 'var(--font-s-thaa), "Noto Sans Thaana", "MV Boli", sans-serif',
  tfng: 'var(--font-s-tfng), "Noto Sans Tifinagh", sans-serif',
  tibt: 'var(--font-s-tibt), "Noto Serif Tibetan", "Kailasa", "Microsoft Himalaya", serif',
  // Not bundled: several megabytes each, and system coverage is near
  // universal. The tofu check catches the machines where it is not.
  hans: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif',
  jpan: '"Hiragino Sans", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif',
  hang: '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif',
};

export function fontStackFor(script) {
  return STACKS[script] || 'inherit';
}
