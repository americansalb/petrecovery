/**
 * The languages the script game draws from, and where they are spoken.
 *
 * Two ideas here, and the second is the point of the mode.
 *
 * 1. **Scripts, with their Unicode ranges.** The ranges are not
 *    decoration: __tests__/geo/script.test.js checks every sample in the
 *    corpus against the ranges of the script it claims, so a sentence
 *    pasted into the wrong row fails the build instead of shipping a
 *    round whose answer is wrong.
 *
 * 2. **Regions, not countries.** Scoring a pin against a country border
 *    makes South Asia one tile: Tamil, Bhojpuri, Marathi and Maithili
 *    all become "India" and the game stops being about language at all.
 *    So each language carries the places it is actually spoken, and a
 *    guess is scored against the nearest one (docs/GEO.md, "Script").
 *    Tamil pinned in Tamil Nadu scores full marks. Tamil pinned in
 *    Punjab does not.
 *
 * Two ways of saying where, and which one a language gets is about how
 * much the map can be trusted, not about how important the language is:
 *
 * - **States, districts, divisions, zones.** South Asian languages name
 *   real administrative units: `{ name, units: ['IN-TN', 'IN-PY'] }`,
 *   resolved against Natural Earth's admin-1 polygons by
 *   `app/lib/geo/server/regions.js`. Anywhere in Tamil Nadu is Tamil,
 *   because that is what a player who knows Tamil knows. A `clip` box
 *   cuts a unit down where a language covers part of one: Bhojpuri is
 *   western Bihar and eastern Uttar Pradesh, not either state whole.
 *   Regions overlap freely, because languages do.
 * - **Discs**, for the rest of the world: [name, cca2, lat, lng,
 *   radiusKm]. A disc is a coarse instrument, and the South Asian rows
 *   used to be discs too until the map showed what that was worth: the
 *   Maithili circle covered half of Nepal. The rest of the corpus is
 *   next, one region of the world at a time.
 *
 * The country code on a disc is there so the test can check the
 * coordinate against the same Natural Earth polygons that name a
 * geography round: a typo that lands Marathi in Pakistan fails rather
 * than ships.
 */

/**
 * Writing systems. `ranges` are inclusive code point pairs; `shared`
 * characters (space, common punctuation) are allowed in any script.
 */
export const SCRIPTS = {
  latn: {
    id: 'latn', name: 'Latin',
    // 0x250-0x2af is IPA Extensions, which is not an academic footnote
    // here: Azerbaijani writes its schwa from that block, and several
    // West African orthographies take open e and open o from it.
    ranges: [[0x41, 0x5a], [0x61, 0x7a], [0xc0, 0x24f], [0x250, 0x2af], [0x300, 0x36f], [0x1e00, 0x1eff], [0x2c60, 0x2c7f]],
  },
  cyrl: { id: 'cyrl', name: 'Cyrillic', ranges: [[0x400, 0x52f], [0x2de0, 0x2dff], [0xa640, 0xa69f]] },
  grek: { id: 'grek', name: 'Greek', ranges: [[0x370, 0x3ff], [0x1f00, 0x1fff]] },
  arab: { id: 'arab', name: 'Arabic', ranges: [[0x600, 0x6ff], [0x750, 0x77f], [0x8a0, 0x8ff], [0xfb50, 0xfdff], [0xfe70, 0xfeff], [0x200c, 0x200f]] },
  hebr: { id: 'hebr', name: 'Hebrew', ranges: [[0x590, 0x5ff], [0xfb1d, 0xfb4f]] },
  deva: { id: 'deva', name: 'Devanagari', ranges: [[0x900, 0x97f], [0xa8e0, 0xa8ff], [0x200c, 0x200d]] },
  beng: { id: 'beng', name: 'Bengali', ranges: [[0x980, 0x9ff], [0x200c, 0x200d]] },
  guru: { id: 'guru', name: 'Gurmukhi', ranges: [[0xa00, 0xa7f], [0x200c, 0x200d]] },
  gujr: { id: 'gujr', name: 'Gujarati', ranges: [[0xa80, 0xaff], [0x200c, 0x200d]] },
  orya: { id: 'orya', name: 'Odia', ranges: [[0xb00, 0xb7f], [0x200c, 0x200d]] },
  taml: { id: 'taml', name: 'Tamil', ranges: [[0xb80, 0xbff], [0x200c, 0x200d]] },
  telu: { id: 'telu', name: 'Telugu', ranges: [[0xc00, 0xc7f], [0x200c, 0x200d]] },
  knda: { id: 'knda', name: 'Kannada', ranges: [[0xc80, 0xcff], [0x200c, 0x200d]] },
  mlym: { id: 'mlym', name: 'Malayalam', ranges: [[0xd00, 0xd7f], [0x200c, 0x200d]] },
  sinh: { id: 'sinh', name: 'Sinhala', ranges: [[0xd80, 0xdff], [0x200c, 0x200d]] },
  thai: { id: 'thai', name: 'Thai', ranges: [[0xe00, 0xe7f]] },
  laoo: { id: 'laoo', name: 'Lao', ranges: [[0xe80, 0xeff]] },
  mymr: { id: 'mymr', name: 'Myanmar', ranges: [[0x1000, 0x109f], [0xa9e0, 0xa9ff], [0xaa60, 0xaa7f], [0x200b, 0x200d]] },
  geor: { id: 'geor', name: 'Georgian', ranges: [[0x10a0, 0x10ff], [0x1c90, 0x1cbf], [0x2d00, 0x2d2f]] },
  ethi: { id: 'ethi', name: 'Ethiopic', ranges: [[0x1200, 0x139f], [0x2d80, 0x2ddf]] },
  armn: { id: 'armn', name: 'Armenian', ranges: [[0x530, 0x58f], [0xfb13, 0xfb17]] },
  khmr: { id: 'khmr', name: 'Khmer', ranges: [[0x1780, 0x17ff], [0x19e0, 0x19ff], [0x200b, 0x200b]] },
  hans: { id: 'hans', name: 'Han', ranges: [[0x2e80, 0x2fdf], [0x3000, 0x303f], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xf900, 0xfaff], [0xff00, 0xffef]] },
  jpan: { id: 'jpan', name: 'Japanese', ranges: [[0x3000, 0x303f], [0x3040, 0x30ff], [0x31f0, 0x31ff], [0x4e00, 0x9fff], [0xff00, 0xffef]] },
  hang: { id: 'hang', name: 'Hangul', ranges: [[0x1100, 0x11ff], [0x3130, 0x318f], [0xa960, 0xa97f], [0xac00, 0xd7af]] },
};

/**
 * Allowed in any sample: whitespace and the punctuation scripts share.
 * The last two are the danda and double danda, which belong to the
 * Devanagari block by code point but end sentences in most Indic
 * scripts. The dashes are written as escapes rather than literals
 * because the house rule bans em dashes in frontend source (CLAUDE.md),
 * and a list of punctuation is the one place one belongs as data.
 */
export const SHARED_CHARS = ' \n\t.,;:!?’‘“”"\'()-\u2013\u2014«»…/।॥';

/**
 * The corpus. `regions` are the places a pin is scored against;
 * `speakers` is millions, rounded hard, and is only used to weight the
 * draw so the game is not three quarters minority languages.
 */
const LANGUAGE_ROWS = [
  // ---- South Asia. The reason this mode exists: every game in the
  // genre answers "India" here, which is the same as not answering.
  {
    code: 'hin', name: 'Hindi', endonym: 'हिन्दी', script: 'deva',
    family: 'Indo-European', branch: 'Indo-Aryan', speakers: 345,
    regions: [
      // Hindi is the official language and the lingua franca of the
      // belt; Bhojpuri, Magahi and Maithili are mother tongues inside
      // it, and both facts are true of the same ground. Regions overlap.
      { name: 'the Hindi belt', units: ['IN-UP', 'IN-BR', 'IN-MP', 'IN-RJ', 'IN-HR', 'IN-DL', 'IN-UT', 'IN-CT', 'IN-JH', 'IN-CH', 'IN-HP'] },
    ],
  },
  {
    code: 'mar', name: 'Marathi', endonym: 'मराठी', script: 'deva',
    family: 'Indo-European', branch: 'Indo-Aryan', speakers: 83,
    regions: [
      { name: 'Maharashtra', units: ['IN-MH', 'IN-DH'] },
      { name: 'Goa', units: ['IN-GA'] },
    ],
  },
  {
    code: 'npi', name: 'Nepali', endonym: 'नेपाली', script: 'deva',
    family: 'Indo-European', branch: 'Indo-Aryan', speakers: 32,
    regions: [
      { name: 'Nepal', units: ['NP-BA', 'NP-BH', 'NP-DH', 'NP-GA', 'NP-JA', 'NP-KA', 'NP-KO', 'NP-LU', 'NP-MA', 'NP-ME', 'NP-NA', 'NP-RA', 'NP-SA', 'NP-SE'] },
      { name: 'Sikkim', units: ['IN-SK'] },
      // The Darjeeling and Kalimpong hills: the top left corner of West
      // Bengal, Nepali-speaking, and the rest of the state is not.
      { name: 'the Darjeeling hills', units: ['IN-WB'], clip: { minLat: 26.7, maxLng: 88.6 } },
    ],
  },
  {
    code: 'bho', name: 'Bhojpuri', endonym: 'भोजपुरी', script: 'deva',
    family: 'Indo-European', branch: 'Indo-Aryan', speakers: 51,
    regions: [
      // Bhojpuri is the clearest case for clipping. It is neither Bihar
      // nor Uttar Pradesh: it is the country either side of the Ganges
      // around the old Bhojpur, and it crosses into the Nepal Terai.
      { name: 'western Bihar', units: ['IN-BR'], clip: { maxLng: 84.9 } },
      { name: 'eastern Uttar Pradesh', units: ['IN-UP'], clip: { minLng: 82.0 } },
      { name: 'the Nepal Terai', units: ['NP-NA'], clip: { maxLat: 27.3 } },
    ],
  },
  {
    code: 'mai', name: 'Maithili', endonym: 'मैथिली', script: 'deva',
    family: 'Indo-European', branch: 'Indo-Aryan', speakers: 34,
    regions: [
      { name: 'Mithila', units: ['IN-BR'], clip: { minLat: 25.3, minLng: 85.2 } },
      { name: 'the Nepal Terai', units: ['NP-JA'], clip: { maxLat: 27.2 } },
    ],
  },
  {
    code: 'ben', name: 'Bengali', endonym: 'বাংলা', script: 'beng',
    family: 'Indo-European', branch: 'Indo-Aryan', speakers: 273,
    regions: [
      { name: 'Bangladesh', units: ['BD-A', 'BD-B', 'BD-C', 'BD-D', 'BD-E', 'BD-F', 'BD-G'] },
      { name: 'West Bengal and Tripura', units: ['IN-WB', 'IN-TR'] },
    ],
  },
  {
    code: 'asm', name: 'Assamese', endonym: 'অসমীয়া', script: 'beng',
    family: 'Indo-European', branch: 'Indo-Aryan', speakers: 15,
    regions: [{ name: 'Assam', units: ['IN-AS'] }],
  },
  {
    code: 'pan', name: 'Punjabi', endonym: 'ਪੰਜਾਬੀ', script: 'guru',
    family: 'Indo-European', branch: 'Indo-Aryan', speakers: 113,
    regions: [
      { name: 'Indian Punjab', units: ['IN-PB', 'IN-CH'] },
      { name: 'Pakistani Punjab', units: ['PK-PB', 'PK-IS'] },
    ],
  },
  {
    code: 'guj', name: 'Gujarati', endonym: 'ગુજરાતી', script: 'gujr',
    family: 'Indo-European', branch: 'Indo-Aryan', speakers: 57,
    regions: [{ name: 'Gujarat', units: ['IN-GJ', 'IN-DH'] }],
  },
  {
    code: 'ory', name: 'Odia', endonym: 'ଓଡ଼ିଆ', script: 'orya',
    family: 'Indo-European', branch: 'Indo-Aryan', speakers: 35,
    regions: [{ name: 'Odisha', units: ['IN-OR'] }],
  },
  {
    code: 'urd', name: 'Urdu', endonym: 'اردو', script: 'arab',
    family: 'Indo-European', branch: 'Indo-Aryan', speakers: 232,
    regions: [
      { name: 'Pakistan', units: ['PK-PB', 'PK-SD', 'PK-KP', 'PK-BA', 'PK-IS', 'PK-TA', 'PK-GB', 'PK-JK'] },
      // Urdu's literary home, and the Hindi belt's other name for the
      // same ground: Delhi and the Doab.
      { name: 'Delhi and Uttar Pradesh', units: ['IN-DL', 'IN-UP'] },
      { name: 'the Deccan', units: ['IN-TG'] },
    ],
  },
  {
    code: 'snd', name: 'Sindhi', endonym: 'سنڌي', script: 'arab',
    family: 'Indo-European', branch: 'Indo-Aryan', speakers: 33,
    regions: [{ name: 'Sindh', units: ['PK-SD'] }],
  },
  {
    code: 'tam', name: 'Tamil', endonym: 'தமிழ்', script: 'taml',
    family: 'Dravidian', branch: 'South Dravidian', speakers: 87,
    regions: [
      { name: 'Tamil Nadu', units: ['IN-TN'] },
      // Puducherry is four enclaves in three states and only two of
      // them are Tamil: this is Puducherry town and Karaikal, both
      // inside Tamil Nadu. Mahe is Malayalam and has its own region
      // there; Yanam is Telugu and falls inside Andhra Pradesh, which
      // Telugu already has.
      { name: 'Puducherry and Karaikal', units: ['IN-PY'], clip: { minLng: 79.0, maxLng: 80.5, maxLat: 12.5 } },
      { name: 'northern and eastern Sri Lanka', units: ['LK-41', 'LK-42', 'LK-43', 'LK-44', 'LK-45', 'LK-51', 'LK-52', 'LK-53'] },
    ],
  },
  {
    code: 'tel', name: 'Telugu', endonym: 'తెలుగు', script: 'telu',
    family: 'Dravidian', branch: 'South-Central Dravidian', speakers: 96,
    regions: [{ name: 'the Telugu states', units: ['IN-AP', 'IN-TG'] }],
  },
  {
    code: 'kan', name: 'Kannada', endonym: 'ಕನ್ನಡ', script: 'knda',
    family: 'Dravidian', branch: 'South Dravidian', speakers: 59,
    regions: [{ name: 'Karnataka', units: ['IN-KA'] }],
  },
  {
    code: 'mal', name: 'Malayalam', endonym: 'മലയാളം', script: 'mlym',
    family: 'Dravidian', branch: 'South Dravidian', speakers: 37,
    regions: [
      { name: 'Kerala', units: ['IN-KL', 'IN-LD'] },
      { name: 'Mahe', units: ['IN-PY'], clip: { maxLng: 76.0 } },
    ],
  },
  {
    code: 'sin', name: 'Sinhala', endonym: 'සිංහල', script: 'sinh',
    family: 'Indo-European', branch: 'Indo-Aryan', speakers: 17,
    regions: [
      { name: 'southern Sri Lanka', units: ['LK-11', 'LK-12', 'LK-13', 'LK-21', 'LK-22', 'LK-23', 'LK-31', 'LK-32', 'LK-33', 'LK-61', 'LK-62', 'LK-71', 'LK-72', 'LK-81', 'LK-82', 'LK-91', 'LK-92'] },
    ],
  },

  // ---- The Arabic-script ladder. Same alphabet, four unrelated
  // answers, which is where a script game gets its depth.
  {
    code: 'arb', name: 'Arabic', endonym: 'العربية', script: 'arab',
    family: 'Afro-Asiatic', branch: 'Semitic', speakers: 335,
    regions: [
      ['Egypt', 'EG', 27.5, 30.8, 330], ['the Gulf', 'SA', 24.2, 45.5, 450],
      ['the Levant', 'SY', 34.0, 37.5, 250], ['the Maghreb', 'DZ', 33.5, 2.5, 500],
      ['Iraq', 'IQ', 33.0, 43.8, 250],
    ],
  },
  {
    code: 'pes', name: 'Persian', endonym: 'فارسی', script: 'arab',
    family: 'Indo-European', branch: 'Iranian', speakers: 79,
    regions: [['Iran', 'IR', 32.5, 53.0, 480], ['western Afghanistan', 'AF', 34.4, 63.5, 180]],
  },
  {
    code: 'pbu', name: 'Pashto', endonym: 'پښتو', script: 'arab',
    family: 'Indo-European', branch: 'Iranian', speakers: 43,
    regions: [['southern Afghanistan', 'AF', 32.5, 66.5, 300], ['Khyber Pakhtunkhwa', 'PK', 33.9, 70.7, 180]],
  },
  {
    code: 'ckb', name: 'Kurdish', endonym: 'کوردی', script: 'arab',
    family: 'Indo-European', branch: 'Iranian', speakers: 8,
    regions: [['Iraqi Kurdistan', 'IQ', 36.0, 44.4, 170], ['eastern Anatolia', 'TR', 38.5, 41.5, 220]],
  },
  {
    code: 'uig', name: 'Uyghur', endonym: 'ئۇيغۇرچە', script: 'arab',
    family: 'Turkic', branch: 'Karluk', speakers: 11,
    regions: [['the Tarim basin', 'CN', 39.8, 79.5, 450]],
  },

  // ---- Cyrillic. Three Slavic answers plus two that are not Slavic
  // at all, which is the whole trap.
  {
    code: 'rus', name: 'Russian', endonym: 'русский', script: 'cyrl',
    family: 'Indo-European', branch: 'Slavic', speakers: 255,
    regions: [['European Russia', 'RU', 55.7, 39.0, 600], ['Siberia', 'RU', 56.0, 84.0, 900]],
  },
  {
    code: 'ukr', name: 'Ukrainian', endonym: 'українська', script: 'cyrl',
    family: 'Indo-European', branch: 'Slavic', speakers: 39,
    regions: [['Ukraine', 'UA', 49.5, 31.0, 400]],
  },
  {
    code: 'bul', name: 'Bulgarian', endonym: 'български', script: 'cyrl',
    family: 'Indo-European', branch: 'Slavic', speakers: 8,
    regions: [['Bulgaria', 'BG', 42.7, 25.2, 180]],
  },
  {
    code: 'srp', name: 'Serbian', endonym: 'српски', script: 'cyrl',
    family: 'Indo-European', branch: 'Slavic', speakers: 9,
    regions: [['Serbia', 'RS', 44.0, 20.9, 160]],
  },
  {
    code: 'kaz', name: 'Kazakh', endonym: 'қазақша', script: 'cyrl',
    family: 'Turkic', branch: 'Kipchak', speakers: 14,
    regions: [['Kazakhstan', 'KZ', 48.5, 67.0, 700]],
  },
  {
    code: 'mon', name: 'Mongolian', endonym: 'монгол', script: 'cyrl',
    family: 'Mongolic', branch: 'Central Mongolic', speakers: 6,
    regions: [['Mongolia', 'MN', 47.0, 104.0, 500]],
  },

  // ---- Scripts with one obvious answer. The easy tier, and the one
  // that teaches the alphabets.
  {
    code: 'ell', name: 'Greek', endonym: 'ελληνικά', script: 'grek',
    family: 'Indo-European', branch: 'Hellenic', speakers: 13,
    regions: [['Greece', 'GR', 39.2, 22.2, 220]],
  },
  {
    code: 'heb', name: 'Hebrew', endonym: 'עברית', script: 'hebr',
    family: 'Afro-Asiatic', branch: 'Semitic', speakers: 9,
    regions: [['Israel', 'IL', 32.0, 34.9, 100]],
  },
  {
    code: 'kat', name: 'Georgian', endonym: 'ქართული', script: 'geor',
    family: 'Kartvelian', branch: 'Karto-Zan', speakers: 4,
    regions: [['Georgia', 'GE', 41.9, 44.0, 150]],
  },
  {
    code: 'hye', name: 'Armenian', endonym: 'հայերեն', script: 'armn',
    family: 'Indo-European', branch: 'Armenian', speakers: 6,
    regions: [['Armenia', 'AM', 40.2, 45.0, 120]],
  },
  {
    code: 'amh', name: 'Amharic', endonym: 'አማርኛ', script: 'ethi',
    family: 'Afro-Asiatic', branch: 'Semitic', speakers: 60,
    regions: [['the Ethiopian highlands', 'ET', 10.5, 38.7, 280]],
  },
  {
    code: 'tir', name: 'Tigrinya', endonym: 'ትግርኛ', script: 'ethi',
    family: 'Afro-Asiatic', branch: 'Semitic', speakers: 10,
    regions: [['Tigray', 'ET', 13.9, 39.0, 130], ['Eritrea', 'ER', 15.4, 38.9, 130]],
  },
  {
    code: 'tha', name: 'Thai', endonym: 'ไทย', script: 'thai',
    family: 'Kra-Dai', branch: 'Tai', speakers: 61,
    regions: [['Thailand', 'TH', 15.4, 100.8, 350]],
  },
  {
    code: 'lao', name: 'Lao', endonym: 'ລາວ', script: 'laoo',
    family: 'Kra-Dai', branch: 'Tai', speakers: 30,
    regions: [['Laos', 'LA', 18.6, 103.4, 250]],
  },
  {
    code: 'khm', name: 'Khmer', endonym: 'ខ្មែរ', script: 'khmr',
    family: 'Austroasiatic', branch: 'Khmeric', speakers: 17,
    regions: [['Cambodia', 'KH', 12.6, 104.9, 200]],
  },
  {
    code: 'mya', name: 'Burmese', endonym: 'မြန်မာ', script: 'mymr',
    family: 'Sino-Tibetan', branch: 'Lolo-Burmese', speakers: 43,
    regions: [['Myanmar', 'MM', 20.5, 96.2, 380]],
  },

  // ---- East Asia. Not bundled as webfonts; system coverage carries
  // them, and the tofu check catches the machines where it does not.
  {
    code: 'cmn', name: 'Mandarin Chinese', endonym: '中文', script: 'hans',
    family: 'Sino-Tibetan', branch: 'Sinitic', speakers: 1100,
    regions: [['northern China', 'CN', 37.5, 114.0, 600], ['Sichuan', 'CN', 30.6, 104.0, 300]],
  },
  {
    code: 'jpn', name: 'Japanese', endonym: '日本語', script: 'jpan',
    family: 'Japonic', branch: 'Japanese', speakers: 123,
    regions: [['Japan', 'JP', 36.0, 138.5, 400]],
  },
  {
    code: 'kor', name: 'Korean', endonym: '한국어', script: 'hang',
    family: 'Koreanic', branch: 'Korean', speakers: 82,
    regions: [['Korea', 'KR', 36.6, 127.9, 220]],
  },

  // ---- Latin script, where the alphabet tells you nothing and the
  // answer is entirely in the words.
  {
    code: 'spa', name: 'Spanish', endonym: 'español', script: 'latn',
    family: 'Indo-European', branch: 'Romance', speakers: 485,
    regions: [['Spain', 'ES', 40.2, -3.7, 350], ['Mexico', 'MX', 21.5, -100.5, 500], ['the Southern Cone', 'AR', -33.0, -62.0, 600], ['the Andes', 'CO', 4.7, -74.5, 400]],
  },
  {
    code: 'por', name: 'Portuguese', endonym: 'português', script: 'latn',
    family: 'Indo-European', branch: 'Romance', speakers: 260,
    regions: [['Portugal', 'PT', 39.6, -8.0, 150], ['Brazil', 'BR', -13.5, -47.0, 900], ['Angola', 'AO', -11.5, 17.5, 400]],
  },
  {
    code: 'ita', name: 'Italian', endonym: 'italiano', script: 'latn',
    family: 'Indo-European', branch: 'Romance', speakers: 65,
    regions: [['Italy', 'IT', 43.2, 12.2, 300]],
  },
  {
    code: 'ron', name: 'Romanian', endonym: 'română', script: 'latn',
    family: 'Indo-European', branch: 'Romance', speakers: 24,
    regions: [['Romania', 'RO', 45.9, 25.0, 220]],
  },
  {
    code: 'fra', name: 'French', endonym: 'français', script: 'latn',
    family: 'Indo-European', branch: 'Romance', speakers: 310,
    regions: [['France', 'FR', 47.0, 2.5, 350], ['Quebec', 'CA', 47.5, -71.5, 300], ['central Africa', 'CD', -3.5, 18.5, 500], ['west Africa', 'CI', 8.0, -5.0, 500]],
  },
  {
    code: 'cat', name: 'Catalan', endonym: 'català', script: 'latn',
    family: 'Indo-European', branch: 'Romance', speakers: 9,
    regions: [['Catalonia', 'ES', 41.7, 1.5, 120]],
  },
  {
    code: 'deu', name: 'German', endonym: 'Deutsch', script: 'latn',
    family: 'Indo-European', branch: 'Germanic', speakers: 135,
    regions: [['Germany', 'DE', 50.7, 10.2, 320], ['Austria', 'AT', 47.6, 14.3, 150]],
  },
  {
    code: 'nld', name: 'Dutch', endonym: 'Nederlands', script: 'latn',
    family: 'Indo-European', branch: 'Germanic', speakers: 25,
    regions: [['the Netherlands', 'NL', 52.2, 5.6, 130], ['Flanders', 'BE', 51.0, 4.4, 70]],
  },
  {
    code: 'afr', name: 'Afrikaans', endonym: 'Afrikaans', script: 'latn',
    family: 'Indo-European', branch: 'Germanic', speakers: 17,
    regions: [['the Cape', 'ZA', -32.0, 21.5, 380]],
  },
  {
    code: 'swe', name: 'Swedish', endonym: 'svenska', script: 'latn',
    family: 'Indo-European', branch: 'Germanic', speakers: 13,
    regions: [['Sweden', 'SE', 59.5, 15.3, 350]],
  },
  {
    code: 'dan', name: 'Danish', endonym: 'dansk', script: 'latn',
    family: 'Indo-European', branch: 'Germanic', speakers: 6,
    regions: [['Denmark', 'DK', 56.2, 9.5, 130]],
  },
  {
    code: 'nob', name: 'Norwegian', endonym: 'norsk', script: 'latn',
    family: 'Indo-European', branch: 'Germanic', speakers: 5,
    regions: [['Norway', 'NO', 61.0, 9.5, 320]],
  },
  {
    code: 'isl', name: 'Icelandic', endonym: 'íslenska', script: 'latn',
    family: 'Indo-European', branch: 'Germanic', speakers: 1,
    regions: [['Iceland', 'IS', 64.9, -18.6, 150]],
  },
  {
    code: 'fin', name: 'Finnish', endonym: 'suomi', script: 'latn',
    family: 'Uralic', branch: 'Finnic', speakers: 5,
    regions: [['Finland', 'FI', 62.5, 26.0, 320]],
  },
  {
    code: 'est', name: 'Estonian', endonym: 'eesti', script: 'latn',
    family: 'Uralic', branch: 'Finnic', speakers: 1,
    regions: [['Estonia', 'EE', 58.7, 25.5, 110]],
  },
  {
    code: 'hun', name: 'Hungarian', endonym: 'magyar', script: 'latn',
    family: 'Uralic', branch: 'Ugric', speakers: 13,
    regions: [['Hungary', 'HU', 47.2, 19.3, 160]],
  },
  {
    code: 'pol', name: 'Polish', endonym: 'polski', script: 'latn',
    family: 'Indo-European', branch: 'Slavic', speakers: 40,
    regions: [['Poland', 'PL', 52.0, 19.5, 260]],
  },
  {
    code: 'ces', name: 'Czech', endonym: 'čeština', script: 'latn',
    family: 'Indo-European', branch: 'Slavic', speakers: 11,
    regions: [['Czechia', 'CZ', 49.8, 15.4, 150]],
  },
  {
    code: 'hrv', name: 'Croatian', endonym: 'hrvatski', script: 'latn',
    family: 'Indo-European', branch: 'Slavic', speakers: 6,
    regions: [['Croatia', 'HR', 45.4, 16.3, 140]],
  },
  {
    code: 'lit', name: 'Lithuanian', endonym: 'lietuvių', script: 'latn',
    family: 'Indo-European', branch: 'Baltic', speakers: 3,
    regions: [['Lithuania', 'LT', 55.3, 24.0, 120]],
  },
  {
    code: 'sqi', name: 'Albanian', endonym: 'shqip', script: 'latn',
    family: 'Indo-European', branch: 'Albanian', speakers: 8,
    regions: [['Albania', 'AL', 41.0, 20.0, 100], ['western North Macedonia', 'MK', 41.9, 20.9, 70]],
  },
  {
    code: 'eus', name: 'Basque', endonym: 'euskara', script: 'latn',
    family: 'isolate', branch: 'Basque', speakers: 1,
    regions: [['the Basque Country', 'ES', 42.9, -2.4, 90]],
  },
  {
    code: 'cym', name: 'Welsh', endonym: 'Cymraeg', script: 'latn',
    family: 'Indo-European', branch: 'Celtic', speakers: 1,
    regions: [['Wales', 'GB', 52.4, -3.7, 100]],
  },
  {
    code: 'tur', name: 'Turkish', endonym: 'Türkçe', script: 'latn',
    family: 'Turkic', branch: 'Oghuz', speakers: 90,
    regions: [['Anatolia', 'TR', 39.2, 33.0, 400]],
  },
  {
    code: 'azj', name: 'Azerbaijani', endonym: 'azərbaycan', script: 'latn',
    family: 'Turkic', branch: 'Oghuz', speakers: 24,
    regions: [['Azerbaijan', 'AZ', 40.3, 47.8, 160], ['Iranian Azerbaijan', 'IR', 37.8, 46.5, 180]],
  },
  {
    code: 'uzn', name: 'Uzbek', endonym: 'o‘zbek', script: 'latn',
    family: 'Turkic', branch: 'Karluk', speakers: 35,
    regions: [['Uzbekistan', 'UZ', 40.5, 65.5, 420]],
  },
  {
    code: 'vie', name: 'Vietnamese', endonym: 'tiếng Việt', script: 'latn',
    family: 'Austroasiatic', branch: 'Vietic', speakers: 86,
    regions: [['the Red River delta', 'VN', 21.0, 105.6, 180], ['the Mekong delta', 'VN', 10.5, 106.0, 200]],
  },
  {
    code: 'ind', name: 'Indonesian', endonym: 'bahasa Indonesia', script: 'latn',
    family: 'Austronesian', branch: 'Malayic', speakers: 200,
    regions: [['Java', 'ID', -7.2, 110.0, 350], ['Sumatra', 'ID', -1.5, 102.0, 450]],
  },
  {
    code: 'zsm', name: 'Malay', endonym: 'bahasa Melayu', script: 'latn',
    family: 'Austronesian', branch: 'Malayic', speakers: 33,
    regions: [['the Malay peninsula', 'MY', 3.7, 102.0, 250]],
  },
  {
    code: 'tgl', name: 'Tagalog', endonym: 'Tagalog', script: 'latn',
    family: 'Austronesian', branch: 'Philippine', speakers: 83,
    regions: [['Luzon', 'PH', 14.8, 121.0, 200]],
  },
  {
    code: 'swh', name: 'Swahili', endonym: 'Kiswahili', script: 'latn',
    family: 'Niger-Congo', branch: 'Bantu', speakers: 87,
    regions: [['the Swahili coast', 'TZ', -6.6, 37.5, 350], ['Kenya', 'KE', -0.5, 37.0, 250]],
  },
  {
    code: 'hau', name: 'Hausa', endonym: 'Hausa', script: 'latn',
    family: 'Afro-Asiatic', branch: 'Chadic', speakers: 88,
    regions: [['northern Nigeria', 'NG', 11.8, 8.3, 300], ['Niger', 'NE', 13.7, 8.5, 250]],
  },
  {
    code: 'yor', name: 'Yoruba', endonym: 'Yorùbá', script: 'latn',
    family: 'Niger-Congo', branch: 'Volta-Niger', speakers: 46,
    regions: [['Yorubaland', 'NG', 7.6, 4.0, 200]],
  },
  {
    code: 'som', name: 'Somali', endonym: 'Soomaali', script: 'latn',
    family: 'Afro-Asiatic', branch: 'Cushitic', speakers: 22,
    regions: [['Somalia', 'SO', 5.0, 46.0, 400]],
  },
  {
    code: 'zul', name: 'Zulu', endonym: 'isiZulu', script: 'latn',
    family: 'Niger-Congo', branch: 'Bantu', speakers: 28,
    regions: [['KwaZulu-Natal', 'ZA', -28.6, 30.6, 170]],
  },
];

export const LANGUAGES = LANGUAGE_ROWS.map((row) => ({
  ...row,
  regions: row.regions.map((region) =>
    Array.isArray(region)
      ? { name: region[0], cca2: region[1], lat: region[2], lng: region[3], radiusKm: region[4] }
      : region
  ),
}));

export const LANGUAGE_BY_CODE = new Map(LANGUAGES.map((language) => [language.code, language]));

export function languageByCode(code) {
  return LANGUAGE_BY_CODE.get(String(code || '')) || null;
}

/** Every script that at least one language in the corpus uses. */
export function scriptsInCorpus() {
  return [...new Set(LANGUAGES.map((language) => language.script))].map((id) => SCRIPTS[id]);
}

/** The languages written in one script: the shared-script ladders. */
export function languagesInScript(script) {
  return LANGUAGES.filter((language) => language.script === script);
}

/** True if the code point is inside one of the script's ranges. */
export function inScript(codePoint, script) {
  const ranges = SCRIPTS[script]?.ranges;
  if (!ranges) return false;
  return ranges.some(([lo, hi]) => codePoint >= lo && codePoint <= hi);
}
