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
 * The files are in the repo (app/fonts/files, one subset per script, the
 * variable weight where Google publishes one; app/fonts/README.md says how
 * they were taken). They used to come from Google Fonts at build time, and
 * one of twenty-eight fetches failing took every Render deploy down with
 * it for two weeks ("Cannot read properties of null (reading '1')" in
 * next/font's loader on Noto Sans Myanmar).
 *
 * Every family is loaded with display: 'swap', so a round shows its text
 * immediately in whatever the device has and upgrades when the real face
 * arrives. None of them is preloaded. next/font preloads every family a
 * route's modules declare, whether or not the page draws a word in it, so
 * every game page, the front door and the rankings included, asked for all
 * twenty-eight at once: 2.6 MB of fonts on a phone's first visit, one of
 * them 714 KB, ahead of the game's own code. A family's @font-face still
 * loads the moment a sentence in its script is on screen, which is the
 * only time it is needed.
 */

import localFont from 'next/font/local';

// next/font reads these calls at build time, so every argument has to
// be a literal here: no shared options object, no spread, no loop.
const arabic = localFont({
  src: '../../fonts/files/noto-arab-arabic-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-arab',
});
const armenian = localFont({
  src: '../../fonts/files/noto-armn-armenian-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-armn',
});
const bengali = localFont({
  src: '../../fonts/files/noto-beng-bengali-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-beng',
});
const devanagari = localFont({
  src: '../../fonts/files/noto-deva-devanagari-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-deva',
});
const ethiopic = localFont({
  src: '../../fonts/files/noto-ethi-ethiopic-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-ethi',
});
const georgian = localFont({
  src: '../../fonts/files/noto-geor-georgian-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-geor',
});
const gujarati = localFont({
  src: '../../fonts/files/noto-gujr-gujarati-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-gujr',
});
const gurmukhi = localFont({
  src: '../../fonts/files/noto-guru-gurmukhi-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-guru',
});
const hebrew = localFont({
  src: '../../fonts/files/noto-hebr-hebrew-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-hebr',
});
const kannada = localFont({
  src: '../../fonts/files/noto-knda-kannada-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-knda',
});
const khmer = localFont({
  src: '../../fonts/files/noto-khmr-khmer-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-khmr',
});
const lao = localFont({
  src: '../../fonts/files/noto-laoo-lao-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-laoo',
});
const malayalam = localFont({
  src: '../../fonts/files/noto-mlym-malayalam-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-mlym',
});
const oriya = localFont({
  src: '../../fonts/files/noto-orya-oriya-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-orya',
});
const sinhala = localFont({
  src: '../../fonts/files/noto-sinh-sinhala-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-sinh',
});
const tamil = localFont({
  src: '../../fonts/files/noto-taml-tamil-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-taml',
});
const telugu = localFont({
  src: '../../fonts/files/noto-telu-telugu-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-telu',
});
const thai = localFont({
  src: '../../fonts/files/noto-thai-thai-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-thai',
});
const myanmar = localFont({
  src: [
    { path: '../../fonts/files/noto-mymr-myanmar-400.woff2', weight: '400', style: 'normal' },
    { path: '../../fonts/files/noto-mymr-myanmar-600.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  variable: '--font-s-mymr',
});
const nko = localFont({
  src: '../../fonts/files/noto-nkoo-nko-400.woff2',
  weight: '400',
  display: 'swap',
  preload: false,
  variable: '--font-s-nkoo',
});
const tifinagh = localFont({
  src: '../../fonts/files/noto-tfng-tifinagh-400.woff2',
  weight: '400',
  display: 'swap',
  preload: false,
  variable: '--font-s-tfng',
});
const adlam = localFont({
  src: '../../fonts/files/noto-adlm-adlam-var.woff2',
  weight: '400 700',
  display: 'swap',
  preload: false,
  variable: '--font-s-adlm',
});
const canadian = localFont({
  src: '../../fonts/files/noto-cans-canadian-aboriginal-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-cans',
});
const cherokee = localFont({
  src: '../../fonts/files/noto-cher-cherokee-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-cher',
});
const meetei = localFont({
  src: '../../fonts/files/noto-mtei-meetei-mayek-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-mtei',
});
const olchiki = localFont({
  src: '../../fonts/files/noto-olck-ol-chiki-var.woff2',
  weight: '400 700',
  display: 'swap',
  preload: false,
  variable: '--font-s-olck',
});
const thaana = localFont({
  src: '../../fonts/files/noto-thaa-thaana-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-thaa',
});
const tibetan = localFont({
  src: '../../fonts/files/noto-tibt-tibetan-var.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-s-tibt',
});

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
