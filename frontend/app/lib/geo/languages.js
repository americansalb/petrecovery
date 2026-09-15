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
 * Where a language is spoken is a list of real places, never a circle:
 *
 * - **A whole country**, for a language that is one:
 *   `{ name: 'Iceland', countries: ['IS'] }`.
 * - **Subdivisions**, where a language covers part of a country or
 *   crosses several: `{ name: 'Tamil Nadu', units: ['IN-TN'] }`,
 *   `{ name: 'Wales', units: ['GB-GWN', ...] }`. Codes are ISO 3166-2.
 * - **Either, clipped**, where the line runs through a unit rather than
 *   round it: `{ countries: ['NE'], clip: { maxLat: 16 } }` is the
 *   Hausa half of Niger, and the rest is desert and Tuareg.
 *
 * All of it resolves against Natural Earth polygons in
 * `app/lib/geo/server/regions.js`. Regions overlap freely, because
 * languages do: Hindi and Urdu share the Doab, Nepali and Bengali share
 * Darjeeling, Spanish and Quechua would share Cusco if Quechua were in
 * here yet.
 *
 * **The rule for contested ground**, and it is the only rule that
 * matters when the map gets political: a region says where a language
 * is spoken, never who a place belongs to. Kurdish names the country it
 * is spoken in across four states; Kirkuk is left out, not because of
 * who governs it but because saying either way would be the game taking
 * a side. Where Natural Earth draws a border, the game draws it too,
 * and where a language crosses one, the language crosses it.
 *
 * A typo in a code cannot ship: __tests__/geo/script.test.js resolves
 * every one, and pins two dozen cities to check the codes mean what
 * they are meant to mean.
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
    // 0x2b0-0x2ff is Spacing Modifier Letters, and it is not a footnote
    // either: Oromo writes its glottal stop as ʼ and Hawaiian writes
    // the okina as ʻ, both from that block, and both are letters in
    // those languages rather than punctuation.
    ranges: [[0x41, 0x5a], [0x61, 0x7a], [0xc0, 0x24f], [0x250, 0x2af], [0x2b0, 0x2ff], [0x300, 0x36f], [0x1e00, 0x1eff], [0x2c60, 0x2c7f]],
  },
  // The two Latin letters are not a mistake: Ossetian's Cyrillic
  // alphabet includes Æ and æ, borrowed whole, and it is the only
  // Cyrillic orthography that does. Its most common vowel is a Latin
  // letter.
  cyrl: { id: 'cyrl', name: 'Cyrillic', ranges: [[0xc6, 0xc6], [0xe6, 0xe6], [0x400, 0x52f], [0x2de0, 0x2dff], [0xa640, 0xa69f]] },
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
  // Nine alphabets each written for a handful of languages, and every
  // one of them settles a round on sight. Two are younger than the
  // people using them: Adlam was invented by two teenage brothers in
  // Guinea in the 1980s, Ol Chiki by a Santal schoolteacher in 1925.
  // Both borrow Arabic punctuation, which is what they are written with
  // rather than a stray character: Thaana is written right to left and
  // came out of Arabic numerals, and N'Ko was designed right to left in
  // a region that writes Arabic.
  thaa: { id: 'thaa', name: 'Thaana', ranges: [[0x60c, 0x60c], [0x61b, 0x61f], [0x780, 0x7bf]] },
  nkoo: { id: 'nkoo', name: 'N\u2019Ko', ranges: [[0x60c, 0x60c], [0x61b, 0x61f], [0x7c0, 0x7ff]] },
  tibt: { id: 'tibt', name: 'Tibetan', ranges: [[0xf00, 0xfff]] },
  olck: { id: 'olck', name: 'Ol Chiki', ranges: [[0x1c50, 0x1c7f]] },
  cans: { id: 'cans', name: 'Canadian syllabics', ranges: [[0x1400, 0x167f], [0x18b0, 0x18ff]] },
  tfng: { id: 'tfng', name: 'Tifinagh', ranges: [[0x2d30, 0x2d7f]] },
  cher: { id: 'cher', name: 'Cherokee', ranges: [[0x13a0, 0x13ff], [0xab70, 0xabbf]] },
  mtei: { id: 'mtei', name: 'Meetei Mayek', ranges: [[0xaae0, 0xaaff], [0xabc0, 0xabff]] },
  adlm: { id: 'adlm', name: 'Adlam', ranges: [[0x1e900, 0x1e95f]] },
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
      { name: 'Egypt and Sudan', countries: ['EG', 'SD'] },
      { name: 'the Maghreb', countries: ['MA', 'DZ', 'TN', 'LY', 'MR'] },
      { name: 'the Levant', countries: ['SY', 'LB', 'JO', 'PS'] },
      { name: 'the Gulf', countries: ['SA', 'YE', 'OM', 'AE', 'QA', 'BH', 'KW'] },
      { name: 'Iraq', countries: ['IQ'] },
    ],
  },
  {
    code: 'pes', name: 'Persian', endonym: 'فارسی', script: 'arab',
    family: 'Indo-European', branch: 'Iranian', speakers: 57,
    // Iran, and only Iran. Persian in Afghanistan is Dari and Persian
    // in Tajikistan is Tajik, and both are their own entry here: one
    // language by any linguistic measure, three standards, and the
    // round is asking which one you are reading. Giving all three to
    // this row would make Kabul and Dushanbe unanswerable.
    regions: [{ name: 'Iran', countries: ['IR'] }],
  },
  {
    code: 'pbu', name: 'Pashto', endonym: 'پښتو', script: 'arab',
    family: 'Indo-European', branch: 'Iranian', speakers: 43,
    regions: [
      { name: 'southern and eastern Afghanistan', units: ['AF-KAN', 'AF-HEL', 'AF-ZAB', 'AF-URU', 'AF-GHA', 'AF-PKA', 'AF-PIA', 'AF-KHO', 'AF-NAN', 'AF-KNR', 'AF-NUR', 'AF-LAG', 'AF-LOG', 'AF-WAR', 'AF-KAB', 'AF-NIM'] },
      { name: 'Khyber Pakhtunkhwa', units: ['PK-KP', 'PK-TA'] },
    ],
  },
  {
    code: 'ckb', name: 'Sorani Kurdish', endonym: 'کوردیی ناوەندی', script: 'arab',
    family: 'Indo-European', branch: 'Iranian', speakers: 8,
    regions: [
      // Kurdish has no state of its own and these are the places, not a
      // claim about whose they are. Kirkuk is left out on purpose: it is
      // contested ground and this is a language game.
      //
      // Iraq and Iran only, and that is the audit's doing. Sorani used
      // to carry south-eastern Anatolia and the Syrian northeast as
      // well, which was defensible while it was the corpus's only
      // Kurdish row. It is not any more: what is written in Turkey and
      // Syria is Kurmanji, in Latin letters, and Kurmanji is its own
      // row. Giving both to Sorani made Diyarbakir score full marks for
      // reading an alphabet nobody uses there.
      { name: 'Iraqi Kurdistan', units: ['IQ-DA', 'IQ-AR', 'IQ-SU'] },
      { name: 'western Iran', units: ['IR-16', 'IR-17', 'IR-05'] },
    ],
  },
  {
    code: 'uig', name: 'Uyghur', endonym: 'ئۇيغۇرچە', script: 'arab',
    family: 'Turkic', branch: 'Karluk', speakers: 11,
    regions: [{ name: 'Xinjiang', units: ['CN-XJ'] }],
  },

  // ---- Cyrillic. Three Slavic answers plus two that are not Slavic
  // at all, which is the whole trap.
  {
    code: 'rus', name: 'Russian', endonym: 'русский', script: 'cyrl',
    family: 'Indo-European', branch: 'Slavic', speakers: 255,
    regions: [
      { name: 'Russia', countries: ['RU'] },
      { name: 'Belarus', countries: ['BY'] },
      { name: 'northern Kazakhstan', countries: ['KZ'], clip: { minLat: 49.5 } },
    ],
  },
  {
    code: 'ukr', name: 'Ukrainian', endonym: 'українська', script: 'cyrl',
    family: 'Indo-European', branch: 'Slavic', speakers: 39,
    regions: [{ name: 'Ukraine', countries: ['UA'] }],
  },
  {
    code: 'bul', name: 'Bulgarian', endonym: 'български', script: 'cyrl',
    family: 'Indo-European', branch: 'Slavic', speakers: 8,
    regions: [{ name: 'Bulgaria', countries: ['BG'] }],
  },
  {
    code: 'srp', name: 'Serbian', endonym: 'српски', script: 'cyrl',
    family: 'Indo-European', branch: 'Slavic', speakers: 9,
    regions: [
      { name: 'Serbia', countries: ['RS'] },
      { name: 'Montenegro and Bosnia', countries: ['ME', 'BA'] },
    ],
  },
  {
    code: 'kaz', name: 'Kazakh', endonym: 'қазақша', script: 'cyrl',
    family: 'Turkic', branch: 'Kipchak', speakers: 14,
    regions: [{ name: 'Kazakhstan', countries: ['KZ'] }],
  },
  {
    code: 'mon', name: 'Mongolian', endonym: 'монгол', script: 'cyrl',
    family: 'Mongolic', branch: 'Central Mongolic', speakers: 6,
    regions: [
      { name: 'Mongolia', countries: ['MN'] },
      { name: 'Inner Mongolia', units: ['CN-NM'] },
    ],
  },

  // ---- Scripts with one obvious answer. The easy tier, and the one
  // that teaches the alphabets.
  {
    code: 'ell', name: 'Greek', endonym: 'ελληνικά', script: 'grek',
    family: 'Indo-European', branch: 'Hellenic', speakers: 13,
    regions: [{ name: 'Greece and Cyprus', countries: ['GR', 'CY'] }],
  },
  {
    code: 'heb', name: 'Hebrew', endonym: 'עברית', script: 'hebr',
    family: 'Afro-Asiatic', branch: 'Semitic', speakers: 9,
    regions: [{ name: 'Israel', countries: ['IL'] }],
  },
  {
    code: 'kat', name: 'Georgian', endonym: 'ქართული', script: 'geor',
    family: 'Kartvelian', branch: 'Karto-Zan', speakers: 4,
    regions: [{ name: 'Georgia', countries: ['GE'] }],
  },
  {
    code: 'hye', name: 'Armenian', endonym: 'հայերեն', script: 'armn',
    family: 'Indo-European', branch: 'Armenian', speakers: 6,
    regions: [{ name: 'Armenia', countries: ['AM'] }],
  },
  {
    code: 'amh', name: 'Amharic', endonym: 'አማርኛ', script: 'ethi',
    family: 'Afro-Asiatic', branch: 'Semitic', speakers: 60,
    regions: [{ name: 'the Ethiopian highlands', units: ['ET-AM', 'ET-AA', 'ET-DD'] }],
  },
  {
    code: 'tir', name: 'Tigrinya', endonym: 'ትግርኛ', script: 'ethi',
    family: 'Afro-Asiatic', branch: 'Semitic', speakers: 10,
    regions: [
      { name: 'Tigray', units: ['ET-TI'] },
      { name: 'Eritrea', countries: ['ER'] },
    ],
  },
  {
    code: 'tha', name: 'Thai', endonym: 'ไทย', script: 'thai',
    family: 'Kra-Dai', branch: 'Tai', speakers: 61,
    regions: [{ name: 'Thailand', countries: ['TH'] }],
  },
  {
    code: 'lao', name: 'Lao', endonym: 'ລາວ', script: 'laoo',
    family: 'Kra-Dai', branch: 'Tai', speakers: 30,
    regions: [{ name: 'Laos', countries: ['LA'] }],
  },
  {
    code: 'khm', name: 'Khmer', endonym: 'ខ្មែរ', script: 'khmr',
    family: 'Austroasiatic', branch: 'Khmeric', speakers: 17,
    regions: [{ name: 'Cambodia', countries: ['KH'] }],
  },
  {
    code: 'mya', name: 'Burmese', endonym: 'မြန်မာ', script: 'mymr',
    family: 'Sino-Tibetan', branch: 'Lolo-Burmese', speakers: 43,
    regions: [{ name: 'Myanmar', countries: ['MM'] }],
  },

  // ---- East Asia. Not bundled as webfonts; system coverage carries
  // them, and the tofu check catches the machines where it does not.
  {
    code: 'cmn', name: 'Mandarin Chinese', endonym: '中文', script: 'hans',
    family: 'Sino-Tibetan', branch: 'Sinitic', speakers: 1100,
    regions: [
      // The whole country, because the question is where you would find
      // the sentence rather than what people grew up speaking. Written
      // Mandarin is the language of every sign, paper and classroom in
      // China, including the places with a mother tongue of their own:
      // Shanghai is Wu, Guangzhou is Cantonese, Lhasa is Tibetan,
      // Kashgar is Uyghur, and all four read this. Those last three are
      // their own rows here and the regions overlap, which is the
      // honest answer rather than a border drawn between them.
      { name: 'China', countries: ['CN'] },
    ],
  },
  {
    code: 'jpn', name: 'Japanese', endonym: '日本語', script: 'jpan',
    family: 'Japonic', branch: 'Japanese', speakers: 123,
    regions: [{ name: 'Japan', countries: ['JP'] }],
  },
  {
    code: 'kor', name: 'Korean', endonym: '한국어', script: 'hang',
    family: 'Koreanic', branch: 'Korean', speakers: 82,
    regions: [{ name: 'Korea', countries: ['KR', 'KP'] }],
  },

  // ---- Latin script, where the alphabet tells you nothing and the
  // answer is entirely in the words.
  {
    code: 'spa', name: 'Spanish', endonym: 'español', script: 'latn',
    family: 'Indo-European', branch: 'Romance', speakers: 485,
    regions: [
      { name: 'Spain', countries: ['ES'] },
      { name: 'Mexico and Central America', countries: ['MX', 'GT', 'HN', 'SV', 'NI', 'CR', 'PA'] },
      { name: 'the Spanish Caribbean', countries: ['CU', 'DO', 'PR'] },
      { name: 'the Andes', countries: ['CO', 'VE', 'EC', 'PE', 'BO'] },
      { name: 'the Southern Cone', countries: ['AR', 'CL', 'UY', 'PY'] },
    ],
  },
  {
    code: 'por', name: 'Portuguese', endonym: 'português', script: 'latn',
    family: 'Indo-European', branch: 'Romance', speakers: 260,
    regions: [
      { name: 'Portugal', countries: ['PT'] },
      { name: 'Brazil', countries: ['BR'] },
      { name: 'lusophone Africa', countries: ['AO', 'MZ', 'CV', 'GW', 'ST'] },
      { name: 'Timor-Leste', countries: ['TL'] },
    ],
  },
  {
    code: 'ita', name: 'Italian', endonym: 'italiano', script: 'latn',
    family: 'Indo-European', branch: 'Romance', speakers: 65,
    regions: [
      { name: 'Italy', countries: ['IT', 'SM'] },
      { name: 'Ticino', units: ['CH-TI'] },
    ],
  },
  {
    code: 'ron', name: 'Romanian', endonym: 'română', script: 'latn',
    family: 'Indo-European', branch: 'Romance', speakers: 24,
    regions: [{ name: 'Romania and Moldova', countries: ['RO', 'MD'] }],
  },
  {
    code: 'fra', name: 'French', endonym: 'français', script: 'latn',
    family: 'Indo-European', branch: 'Romance', speakers: 310,
    regions: [
      { name: 'France', countries: ['FR'] },
      { name: 'Quebec', units: ['CA-QC'] },
      { name: 'Wallonia and Brussels', units: ['BE-WHT', 'BE-WNA', 'BE-WLX', 'BE-WLG', 'BE-WBR', 'BE-BRU'] },
      { name: 'Romandy', units: ['CH-GE', 'CH-VD', 'CH-NE', 'CH-JU', 'CH-FR', 'CH-VS'] },
      { name: 'francophone Africa', countries: ['SN', 'ML', 'BF', 'CI', 'GN', 'TG', 'BJ', 'NE', 'TD', 'CM', 'GA', 'CG', 'CD', 'CF', 'MG'] },
    ],
  },
  {
    code: 'cat', name: 'Catalan', endonym: 'català', script: 'latn',
    family: 'Indo-European', branch: 'Romance', speakers: 9,
    regions: [
      { name: 'Catalonia', units: ['ES-B', 'ES-T', 'ES-L', 'ES-GI'] },
      { name: 'Valencia and the Balearics', units: ['ES-V', 'ES-CS', 'ES-A', 'ES-PM'] },
      { name: 'Andorra', countries: ['AD'] },
      { name: 'northern Catalonia', units: ['FR-66'] },
    ],
  },
  {
    code: 'deu', name: 'German', endonym: 'Deutsch', script: 'latn',
    family: 'Indo-European', branch: 'Germanic', speakers: 135,
    regions: [
      { name: 'Germany, Austria and Liechtenstein', countries: ['DE', 'AT', 'LI'] },
      { name: 'German-speaking Switzerland', units: ['CH-ZH', 'CH-BE', 'CH-LU', 'CH-UR', 'CH-SZ', 'CH-OW', 'CH-NW', 'CH-GL', 'CH-ZG', 'CH-SO', 'CH-BS', 'CH-BL', 'CH-SH', 'CH-AR', 'CH-AI', 'CH-SG', 'CH-GR', 'CH-AG', 'CH-TG'] },
    ],
  },
  {
    code: 'nld', name: 'Dutch', endonym: 'Nederlands', script: 'latn',
    family: 'Indo-European', branch: 'Germanic', speakers: 25,
    regions: [
      { name: 'the Netherlands', countries: ['NL'] },
      { name: 'Flanders', units: ['BE-VWV', 'BE-VOV', 'BE-VAN', 'BE-VLI', 'BE-VBR', 'BE-BRU'] },
      { name: 'Suriname', countries: ['SR'] },
    ],
  },
  {
    code: 'afr', name: 'Afrikaans', endonym: 'Afrikaans', script: 'latn',
    family: 'Indo-European', branch: 'Germanic', speakers: 17,
    regions: [
      { name: 'the Cape and the Free State', units: ['ZA-WC', 'ZA-NC', 'ZA-FS'] },
      { name: 'Namibia', countries: ['NA'] },
    ],
  },
  {
    code: 'swe', name: 'Swedish', endonym: 'svenska', script: 'latn',
    family: 'Indo-European', branch: 'Germanic', speakers: 13,
    regions: [{ name: 'Sweden', countries: ['SE'] }],
  },
  {
    code: 'dan', name: 'Danish', endonym: 'dansk', script: 'latn',
    family: 'Indo-European', branch: 'Germanic', speakers: 6,
    regions: [{ name: 'Denmark', countries: ['DK'] }],
  },
  {
    code: 'nob', name: 'Norwegian', endonym: 'norsk', script: 'latn',
    family: 'Indo-European', branch: 'Germanic', speakers: 5,
    regions: [{ name: 'Norway', countries: ['NO'] }],
  },
  {
    code: 'isl', name: 'Icelandic', endonym: 'íslenska', script: 'latn',
    family: 'Indo-European', branch: 'Germanic', speakers: 1,
    regions: [{ name: 'Iceland', countries: ['IS'] }],
  },
  {
    code: 'fin', name: 'Finnish', endonym: 'suomi', script: 'latn',
    family: 'Uralic', branch: 'Finnic', speakers: 5,
    regions: [{ name: 'Finland', countries: ['FI'] }],
  },
  {
    code: 'est', name: 'Estonian', endonym: 'eesti', script: 'latn',
    family: 'Uralic', branch: 'Finnic', speakers: 1,
    regions: [{ name: 'Estonia', countries: ['EE'] }],
  },
  {
    code: 'hun', name: 'Hungarian', endonym: 'magyar', script: 'latn',
    family: 'Uralic', branch: 'Ugric', speakers: 13,
    regions: [
      { name: 'Hungary', countries: ['HU'] },
      // The Székely counties, where Hungarian is the majority language
      // inside Romania.
      { name: 'Székely Land', units: ['RO-HR', 'RO-CV', 'RO-MS'] },
    ],
  },
  {
    code: 'pol', name: 'Polish', endonym: 'polski', script: 'latn',
    family: 'Indo-European', branch: 'Slavic', speakers: 40,
    regions: [{ name: 'Poland', countries: ['PL'] }],
  },
  {
    code: 'ces', name: 'Czech', endonym: 'čeština', script: 'latn',
    family: 'Indo-European', branch: 'Slavic', speakers: 11,
    regions: [{ name: 'Czechia', countries: ['CZ'] }],
  },
  {
    code: 'hrv', name: 'Croatian', endonym: 'hrvatski', script: 'latn',
    family: 'Indo-European', branch: 'Slavic', speakers: 6,
    regions: [
      { name: 'Croatia', countries: ['HR'] },
      { name: 'Bosnia and Herzegovina', countries: ['BA'] },
    ],
  },
  {
    code: 'lit', name: 'Lithuanian', endonym: 'lietuvių', script: 'latn',
    family: 'Indo-European', branch: 'Baltic', speakers: 3,
    regions: [{ name: 'Lithuania', countries: ['LT'] }],
  },
  {
    code: 'sqi', name: 'Albanian', endonym: 'shqip', script: 'latn',
    family: 'Indo-European', branch: 'Albanian', speakers: 8,
    regions: [
      { name: 'Albania and Kosovo', countries: ['AL', 'XK'] },
      { name: 'western North Macedonia', countries: ['MK'], clip: { maxLng: 21.4 } },
    ],
  },
  {
    code: 'eus', name: 'Basque', endonym: 'euskara', script: 'latn',
    family: 'isolate', branch: 'Basque', speakers: 1,
    regions: [
      { name: 'the Basque Country and Navarre', units: ['ES-BI', 'ES-SS', 'ES-VI', 'ES-NA'] },
      // The French Basque Country is the western third of the
      // Pyrénées-Atlantiques; the rest of that department is Béarn.
      { name: 'the French Basque Country', units: ['FR-64'], clip: { maxLng: -0.75 } },
    ],
  },
  {
    code: 'cym', name: 'Welsh', endonym: 'Cymraeg', script: 'latn',
    family: 'Indo-European', branch: 'Celtic', speakers: 1,
    regions: [
      { name: 'Wales', units: ['GB-GWN', 'GB-CWY', 'GB-DEN', 'GB-FLN', 'GB-WRX', 'GB-POW', 'GB-CGN', 'GB-PEM', 'GB-CMN', 'GB-SWA', 'GB-NTL', 'GB-BGE', 'GB-VGL', 'GB-CRF', 'GB-NWP', 'GB-MON'] },
    ],
  },
  {
    code: 'tur', name: 'Turkish', endonym: 'Türkçe', script: 'latn',
    family: 'Turkic', branch: 'Oghuz', speakers: 90,
    regions: [{ name: 'Turkey', countries: ['TR'] }],
  },
  {
    code: 'azj', name: 'Azerbaijani', endonym: 'azərbaycan', script: 'latn',
    family: 'Turkic', branch: 'Oghuz', speakers: 24,
    regions: [
      { name: 'Azerbaijan', countries: ['AZ'] },
      { name: 'Iranian Azerbaijan', units: ['IR-01', 'IR-02', 'IR-03', 'IR-11'] },
    ],
  },
  {
    code: 'uzn', name: 'Uzbek', endonym: 'o‘zbek', script: 'latn',
    family: 'Turkic', branch: 'Karluk', speakers: 35,
    regions: [{ name: 'Uzbekistan', countries: ['UZ'] }],
  },
  {
    code: 'vie', name: 'Vietnamese', endonym: 'tiếng Việt', script: 'latn',
    family: 'Austroasiatic', branch: 'Vietic', speakers: 86,
    regions: [{ name: 'Vietnam', countries: ['VN'] }],
  },
  {
    code: 'ind', name: 'Indonesian', endonym: 'bahasa Indonesia', script: 'latn',
    family: 'Austronesian', branch: 'Malayic', speakers: 200,
    regions: [{ name: 'Indonesia', countries: ['ID'] }],
  },
  {
    code: 'zsm', name: 'Malay', endonym: 'bahasa Melayu', script: 'latn',
    family: 'Austronesian', branch: 'Malayic', speakers: 33,
    regions: [{ name: 'Malaysia, Brunei and Singapore', countries: ['MY', 'BN', 'SG'] }],
  },
  {
    code: 'tgl', name: 'Tagalog', endonym: 'Tagalog', script: 'latn',
    family: 'Austronesian', branch: 'Philippine', speakers: 83,
    regions: [
      // Tagalog is Luzon and the islands off it, not the whole
      // archipelago: the Visayas and Mindanao speak their own.
      { name: 'Luzon', countries: ['PH'], clip: { minLat: 12.2 } },
    ],
  },
  {
    code: 'swh', name: 'Swahili', endonym: 'Kiswahili', script: 'latn',
    family: 'Niger-Congo', branch: 'Bantu', speakers: 87,
    regions: [{ name: 'Tanzania, Kenya and Uganda', countries: ['TZ', 'KE', 'UG'] }],
  },
  {
    code: 'hau', name: 'Hausa', endonym: 'Hausa', script: 'latn',
    family: 'Afro-Asiatic', branch: 'Chadic', speakers: 88,
    regions: [
      { name: 'northern Nigeria', units: ['NG-KN', 'NG-KT', 'NG-JI', 'NG-ZA', 'NG-SO', 'NG-KE', 'NG-KD', 'NG-BA', 'NG-GO', 'NG-YO', 'NG-BO', 'NG-NI'] },
      // Hausa country runs along the Niger border; the north of Niger
      // is Tuareg, and mostly desert.
      { name: 'southern Niger', countries: ['NE'], clip: { maxLat: 16 } },
    ],
  },
  {
    code: 'yor', name: 'Yoruba', endonym: 'Yorùbá', script: 'latn',
    family: 'Niger-Congo', branch: 'Volta-Niger', speakers: 46,
    regions: [{ name: 'Yorubaland', units: ['NG-LA', 'NG-OG', 'NG-OY', 'NG-OS', 'NG-ON', 'NG-EK', 'NG-KW'] }],
  },
  {
    code: 'som', name: 'Somali', endonym: 'Soomaali', script: 'latn',
    family: 'Afro-Asiatic', branch: 'Cushitic', speakers: 22,
    regions: [
      { name: 'Somalia', countries: ['SO'] },
      // Natural Earth draws a line across the north and gives the piece
      // above it no ISO code, so the builder used to drop it and the
      // game scored Hargeisa as fifty kilometres from anywhere Somali
      // is used. The language is used either side of that line, and
      // saying so is not saying whose the ground is.
      { name: 'the northwest', countries: ['XS'] },
      { name: 'Djibouti', countries: ['DJ'] },
      { name: 'the Somali region of Ethiopia', units: ['ET-SO'] },
    ],
  },
  {
    code: 'zul', name: 'Zulu', endonym: 'isiZulu', script: 'latn',
    family: 'Niger-Congo', branch: 'Bantu', speakers: 28,
    regions: [{ name: 'KwaZulu-Natal and the Highveld', units: ['ZA-NL', 'ZA-GT', 'ZA-MP'] }],
  },
  // ---------------------------------------------------------------
  // Added 2026-09-15. Chosen for what they teach: a language next to
  // one already in the pool, so the round is a real decision rather
  // than a guess at a continent. Macedonian against Bulgarian, Slovak
  // against Czech, Latvian against Lithuanian, Galician between
  // Spanish and Portuguese, Scottish Gaelic against Irish, Tajik
  // against Persian in a different alphabet.
  {
    code: 'mkd', name: 'Macedonian', endonym: 'македонски', script: 'cyrl',
    family: 'Indo-European', branch: 'Slavic', speakers: 2,
    regions: [{ name: 'North Macedonia', countries: ['MK'] }],
  },
  {
    code: 'bel', name: 'Belarusian', endonym: 'беларуская', script: 'cyrl',
    family: 'Indo-European', branch: 'Slavic', speakers: 5,
    regions: [{ name: 'Belarus', countries: ['BY'] }],
  },
  {
    code: 'tgk', name: 'Tajik', endonym: 'тоҷикӣ', script: 'cyrl',
    family: 'Indo-European', branch: 'Iranian', speakers: 8,
    regions: [{ name: 'Tajikistan', countries: ['TJ'] }],
  },
  {
    code: 'kir', name: 'Kyrgyz', endonym: 'кыргызча', script: 'cyrl',
    family: 'Turkic', branch: 'Kipchak', speakers: 5,
    regions: [{ name: 'Kyrgyzstan', countries: ['KG'] }],
  },
  {
    code: 'slk', name: 'Slovak', endonym: 'slovenčina', script: 'latn',
    family: 'Indo-European', branch: 'Slavic', speakers: 5,
    regions: [{ name: 'Slovakia', countries: ['SK'] }],
  },
  {
    code: 'slv', name: 'Slovene', endonym: 'slovenščina', script: 'latn',
    family: 'Indo-European', branch: 'Slavic', speakers: 2,
    regions: [{ name: 'Slovenia', countries: ['SI'] }],
  },
  {
    code: 'lav', name: 'Latvian', endonym: 'latviešu', script: 'latn',
    family: 'Indo-European', branch: 'Baltic', speakers: 2,
    regions: [{ name: 'Latvia', countries: ['LV'] }],
  },
  {
    code: 'glg', name: 'Galician', endonym: 'galego', script: 'latn',
    family: 'Indo-European', branch: 'Romance', speakers: 2,
    // The northwest corner of Spain. The inland edge is a straight line
    // because the Galician-Portuguese continuum has no border on it.
    regions: [{ name: 'Galicia', units: ['ES-C', 'ES-LU', 'ES-OR', 'ES-PO'] }],

  },
  {
    code: 'gle', name: 'Irish', endonym: 'Gaeilge', script: 'latn',
    family: 'Indo-European', branch: 'Celtic', speakers: 2,
    // The whole island where it is taught and official, rather than the
    // Gaeltacht alone: a pin anywhere in Ireland is the right answer to
    // the question this round asks.
    regions: [{ name: 'Ireland', countries: ['IE'] }],
  },
  {
    code: 'gla', name: 'Scottish Gaelic', endonym: 'Gàidhlig', script: 'latn',
    family: 'Indo-European', branch: 'Celtic', speakers: 0.1,
    regions: [{ name: 'the Highlands and Islands', units: ['GB-ELS', 'GB-HLD', 'GB-AGB'] }],

  },
  {
    code: 'mlt', name: 'Maltese', endonym: 'Malti', script: 'latn',
    family: 'Afro-Asiatic', branch: 'Semitic', speakers: 0.5,
    regions: [{ name: 'Malta', countries: ['MT'] }],
  },
  {
    code: 'fao', name: 'Faroese', endonym: 'føroyskt', script: 'latn',
    family: 'Indo-European', branch: 'Germanic', speakers: 0.07,
    regions: [{ name: 'the Faroe Islands', countries: ['FO'] }],
  },
  {
    code: 'ltz', name: 'Luxembourgish', endonym: 'Lëtzebuergesch', script: 'latn',
    family: 'Indo-European', branch: 'Germanic', speakers: 0.4,
    regions: [{ name: 'Luxembourg', countries: ['LU'] }],
  },
  {
    code: 'bre', name: 'Breton', endonym: 'brezhoneg', script: 'latn',
    family: 'Indo-European', branch: 'Celtic', speakers: 0.2,
    regions: [{ name: 'Lower Brittany', units: ['FR-29', 'FR-22', 'FR-56'] }],

  },
  {
    code: 'fry', name: 'West Frisian', endonym: 'Frysk', script: 'latn',
    family: 'Indo-European', branch: 'Germanic', speakers: 0.5,
    regions: [{ name: 'Friesland', units: ['NL-FR'] }],

  },
  // ---------------------------------------------------------------
  // Added 2026-09-15. Nine alphabets that were not in the game, and the
  // languages either side of the ones that were.
  {
    code: 'div', name: 'Dhivehi', endonym: 'ދިވެހި', script: 'thaa',
    family: 'Indo-European', branch: 'Indo-Aryan', speakers: 0.3,
    regions: [{ name: 'the Maldives', countries: ['MV'] }],
  },
  {
    code: 'bod', name: 'Tibetan', endonym: 'བོད་སྐད།', script: 'tibt',
    family: 'Sino-Tibetan', branch: 'Tibetic', speakers: 6,
    regions: [{ name: 'the Tibetan plateau', units: ['CN-XZ', 'CN-QH'] }],

  },
  {
    code: 'dzo', name: 'Dzongkha', endonym: 'རྫོང་ཁ', script: 'tibt',
    family: 'Sino-Tibetan', branch: 'Tibetic', speakers: 0.6,
    regions: [{ name: 'Bhutan', countries: ['BT'] }],
  },
  {
    code: 'sat', name: 'Santali', endonym: 'ᱥᱟᱱᱛᱟᱲᱤ', script: 'olck',
    family: 'Austroasiatic', branch: 'Munda', speakers: 7,
    regions: [{ name: 'the Chota Nagpur plateau', units: ['IN-JH'] }, { name: 'northern Odisha and western Bengal', units: ['IN-OR', 'IN-WB'], clip: { minLat: 21.0, maxLat: 24.5, maxLng: 87.6 } }],
  },
  {
    code: 'mni', name: 'Manipuri', endonym: 'ꯃꯤꯇꯩ ꯂꯣꯟ', script: 'mtei',
    family: 'Sino-Tibetan', branch: 'Kuki-Chin-Naga', speakers: 1.8,
    regions: [{ name: 'Manipur', units: ['IN-MN'] }],
  },
  {
    code: 'chr', name: 'Cherokee', endonym: 'ᏣᎳᎩ', script: 'cher',
    family: 'Iroquoian', branch: 'Southern Iroquoian', speakers: 0.002,
    regions: [
      { name: 'the Cherokee Nation', units: ['US-OK'], clip: { minLng: -96.0 } },
      { name: 'the Qualla Boundary', units: ['US-NC'], clip: { maxLng: -83.0 } },
    ],

  },
  {
    code: 'iku', name: 'Inuktitut', endonym: 'ᐃᓄᒃᑎᑐᑦ', script: 'cans',
    family: 'Eskimo-Aleut', branch: 'Inuit', speakers: 0.04,
    regions: [{ name: 'Nunavut', units: ['CA-NU'] }],

  },
  {
    code: 'nqo', name: 'Manding', endonym: 'ߒߞߏ', script: 'nkoo',
    family: 'Niger-Congo', branch: 'Mande', speakers: 40,
    regions: [{ name: 'Guinea', countries: ['GN'] }, { name: 'southern Mali', countries: ['ML'], clip: { maxLat: 15.0 } }],
  },
  {
    code: 'fuf', name: 'Pular', endonym: '𞤆𞤵𞤤𞤢𞤪', script: 'adlm',
    family: 'Niger-Congo', branch: 'Senegambian', speakers: 5,
    regions: [{ name: 'the Fouta Djallon', units: ['GN-LA', 'GN-MM', 'GN-DL', 'GN-PI', 'GN-TO', 'GN-KB'] }],

  },
  {
    code: 'zgh', name: 'Tamazight', endonym: 'ⵜⴰⵎⴰⵣⵉⵖⵜ', script: 'tfng',
    family: 'Afro-Asiatic', branch: 'Berber', speakers: 14,
    regions: [{ name: 'the Atlas and the Rif', countries: ['MA'] }],
  },
  {
    code: 'gom', name: 'Konkani', endonym: 'कोंकणी', script: 'deva',
    family: 'Indo-European', branch: 'Indo-Aryan', speakers: 2.3,
    regions: [{ name: 'Goa', units: ['IN-GA'] }, { name: 'the Konkan coast', units: ['IN-KA'], clip: { minLat: 13.8, maxLat: 15.0, maxLng: 74.8 } }],
  },
  {
    code: 'doi', name: 'Dogri', endonym: 'डोगरी', script: 'deva',
    family: 'Indo-European', branch: 'Indo-Aryan', speakers: 2.6,
    regions: [{ name: 'the Jammu hills', units: ['IN-JK'], clip: { maxLat: 33.5 } }],
  },
  {
    code: 'awa', name: 'Awadhi', endonym: 'अवधी', script: 'deva',
    family: 'Indo-European', branch: 'Indo-Aryan', speakers: 4,
    regions: [{ name: 'Awadh', units: ['IN-UP'], clip: { minLng: 79.5, maxLng: 82.2, maxLat: 27.6 } }],
  },
  {
    code: 'new', name: 'Newar', endonym: 'नेपाल भाषा', script: 'deva',
    family: 'Sino-Tibetan', branch: 'Newaric', speakers: 0.85,
    regions: [{ name: 'the Kathmandu valley', units: ['NP-BA'] }],

  },
  {
    code: 'pnb', name: 'Western Punjabi', endonym: 'پنجابی', script: 'arab',
    family: 'Indo-European', branch: 'Indo-Aryan', speakers: 92,
    regions: [{ name: 'Punjab', units: ['PK-PB'] }],
  },
  {
    code: 'prs', name: 'Dari', endonym: 'دری', script: 'arab',
    family: 'Indo-European', branch: 'Iranian', speakers: 15,
    regions: [{ name: 'northern and central Afghanistan', units: ['AF-HER', 'AF-BDG', 'AF-FRA', 'AF-GHO', 'AF-BAM', 'AF-BAL', 'AF-JOW', 'AF-FYB', 'AF-SAR', 'AF-SAM', 'AF-BGL', 'AF-TAK', 'AF-KDZ', 'AF-BDS', 'AF-PAR', 'AF-KAP', 'AF-KAB'] }],

  },
  {
    code: 'bal', name: 'Balochi', endonym: 'بلۏچی', script: 'arab',
    family: 'Indo-European', branch: 'Iranian', speakers: 8,
    regions: [{ name: 'Balochistan', units: ['PK-BA'] }, { name: 'Sistan and Baluchestan', units: ['IR-13'] }],
  },
  {
    code: 'kas', name: 'Kashmiri', endonym: 'كٲشُر', script: 'arab',
    family: 'Indo-European', branch: 'Dardic', speakers: 7,
    regions: [{ name: 'the Kashmir valley', units: ['IN-JK'], clip: { minLat: 33.3, maxLat: 34.7, minLng: 74.2, maxLng: 75.5 } }],
  },
  {
    code: 'arz', name: 'Egyptian Arabic', endonym: 'مصري', script: 'arab',
    family: 'Afro-Asiatic', branch: 'Semitic', speakers: 78,
    regions: [{ name: 'the Nile valley and delta', countries: ['EG'] }],
  },
  {
    code: 'ary', name: 'Moroccan Arabic', endonym: 'الدارجة', script: 'arab',
    family: 'Afro-Asiatic', branch: 'Semitic', speakers: 33,
    regions: [{ name: 'Morocco', countries: ['MA'] }],
  },
  {
    code: 'tat', name: 'Tatar', endonym: 'татарча', script: 'cyrl',
    family: 'Turkic', branch: 'Kipchak', speakers: 5,
    regions: [{ name: 'Tatarstan', units: ['RU-TA'] }],

  },
  {
    code: 'bak', name: 'Bashkir', endonym: 'башҡортса', script: 'cyrl',
    family: 'Turkic', branch: 'Kipchak', speakers: 1.2,
    regions: [{ name: 'Bashkortostan', units: ['RU-BA'] }],

  },
  {
    code: 'chv', name: 'Chuvash', endonym: 'чӑвашла', script: 'cyrl',
    family: 'Turkic', branch: 'Oghur', speakers: 1,
    regions: [{ name: 'Chuvashia', units: ['RU-CU'] }],

  },
  {
    code: 'sah', name: 'Sakha', endonym: 'саха тыла', script: 'cyrl',
    family: 'Turkic', branch: 'Siberian', speakers: 0.45,
    regions: [{ name: 'Sakha', units: ['RU-SA'] }],

  },
  {
    code: 'oss', name: 'Ossetian', endonym: 'ирон æвзаг', script: 'cyrl',
    family: 'Indo-European', branch: 'Iranian', speakers: 0.5,
    regions: [{ name: 'North Ossetia', units: ['RU-SE'] }],

  },
  {
    code: 'che', name: 'Chechen', endonym: 'нохчийн мотт', script: 'cyrl',
    family: 'Northeast Caucasian', branch: 'Nakh', speakers: 1.4,
    regions: [{ name: 'Chechnya', units: ['RU-CE'] }],

  },
  {
    code: 'bos', name: 'Bosnian', endonym: 'bosanski', script: 'latn',
    family: 'Indo-European', branch: 'Slavic', speakers: 2.5,
    regions: [{ name: 'Bosnia and Herzegovina', countries: ['BA'] }],
  },
  {
    code: 'oci', name: 'Occitan', endonym: 'occitan', script: 'latn',
    family: 'Indo-European', branch: 'Romance', speakers: 0.5,
    regions: [{ name: 'the Midi', countries: ['FR'], clip: { maxLat: 45.4, minLat: 42.4 } }],
  },
  {
    code: 'srd', name: 'Sardinian', endonym: 'sardu', script: 'latn',
    family: 'Indo-European', branch: 'Romance', speakers: 1,
    regions: [{ name: 'Sardinia', units: ['IT-SS', 'IT-NU', 'IT-CA'] }],

  },
  {
    code: 'ast', name: 'Asturian', endonym: 'asturianu', script: 'latn',
    family: 'Indo-European', branch: 'Romance', speakers: 0.6,
    regions: [{ name: 'Asturias', units: ['ES-O'] }],

  },
  {
    code: 'roh', name: 'Romansh', endonym: 'rumantsch', script: 'latn',
    family: 'Indo-European', branch: 'Romance', speakers: 0.04,
    regions: [{ name: 'the Grisons', units: ['CH-GR'] }],

  },
  {
    code: 'fur', name: 'Friulian', endonym: 'furlan', script: 'latn',
    family: 'Indo-European', branch: 'Romance', speakers: 0.6,
    regions: [{ name: 'Friuli', units: ['IT-UD', 'IT-PN', 'IT-GO'] }],

  },
  {
    code: 'sme', name: 'Northern Sami', endonym: 'davvisámegiella', script: 'latn',
    family: 'Uralic', branch: 'Sami', speakers: 0.025,
    regions: [{ name: 'Sapmi', countries: ['NO', 'SE', 'FI'], clip: { minLat: 67.5 } }],
  },
  {
    code: 'hsb', name: 'Upper Sorbian', endonym: 'hornjoserbsce', script: 'latn',
    family: 'Indo-European', branch: 'Slavic', speakers: 0.013,
    regions: [{ name: 'Upper Lusatia', units: ['DE-SN'], clip: { minLng: 14.0 } }],

  },
  {
    code: 'ibo', name: 'Igbo', endonym: 'Asụsụ Igbo', script: 'latn',
    family: 'Niger-Congo', branch: 'Volta-Niger', speakers: 31,
    regions: [{ name: 'Igboland', units: ['NG-EN', 'NG-AN', 'NG-IM', 'NG-AB', 'NG-EB'] }],
  },
  {
    code: 'aka', name: 'Akan', endonym: 'Akan', script: 'latn',
    family: 'Niger-Congo', branch: 'Kwa', speakers: 11,
    regions: [{ name: 'southern Ghana', units: ['GH-AH', 'GH-BA', 'GH-CP', 'GH-WP', 'GH-EP', 'GH-AA'] }],

  },
  {
    code: 'wol', name: 'Wolof', endonym: 'Wolof', script: 'latn',
    family: 'Niger-Congo', branch: 'Senegambian', speakers: 12,
    regions: [{ name: 'Senegal', countries: ['SN'] }],
  },
  {
    code: 'kin', name: 'Kinyarwanda', endonym: 'Ikinyarwanda', script: 'latn',
    family: 'Niger-Congo', branch: 'Bantu', speakers: 12,
    regions: [{ name: 'Rwanda', countries: ['RW'] }],
  },
  {
    code: 'nya', name: 'Chichewa', endonym: 'Chichewa', script: 'latn',
    family: 'Niger-Congo', branch: 'Bantu', speakers: 14,
    regions: [{ name: 'Malawi', countries: ['MW'] }],
  },
  {
    code: 'sna', name: 'Shona', endonym: 'chiShona', script: 'latn',
    family: 'Niger-Congo', branch: 'Bantu', speakers: 11,
    regions: [{ name: 'Zimbabwe', countries: ['ZW'] }],
  },
  {
    code: 'xho', name: 'Xhosa', endonym: 'isiXhosa', script: 'latn',
    family: 'Niger-Congo', branch: 'Bantu', speakers: 8,
    regions: [{ name: 'the Eastern Cape', units: ['ZA-EC'] }, { name: 'the Cape Town area', units: ['ZA-WC'], clip: { maxLng: 19.5, minLat: -34.4, maxLat: -33.4 } }],
  },
  {
    code: 'sot', name: 'Sesotho', endonym: 'Sesotho', script: 'latn',
    family: 'Niger-Congo', branch: 'Bantu', speakers: 6,
    regions: [{ name: 'Lesotho', countries: ['LS'] }, { name: 'the Free State', units: ['ZA-FS'] }],
  },
  {
    code: 'tsn', name: 'Tswana', endonym: 'Setswana', script: 'latn',
    family: 'Niger-Congo', branch: 'Bantu', speakers: 6,
    regions: [{ name: 'Botswana', countries: ['BW'] }, { name: 'the North West', units: ['ZA-NW'] }],
  },
  {
    code: 'lug', name: 'Luganda', endonym: 'Luganda', script: 'latn',
    family: 'Niger-Congo', branch: 'Bantu', speakers: 11,
    regions: [{ name: 'Buganda', units: ['UG-102', 'UG-113', 'UG-106', 'UG-105', 'UG-107', 'UG-108'] }],

  },
  {
    code: 'lin', name: 'Lingala', endonym: 'Lingála', script: 'latn',
    family: 'Niger-Congo', branch: 'Bantu', speakers: 20,
    regions: [{ name: 'the Congo river', countries: ['CD'], clip: { minLat: -5.5, maxLat: 4.5, minLng: 15.0, maxLng: 22.5 } }, { name: 'Congo-Brazzaville', countries: ['CG'] }],
  },
  {
    code: 'bam', name: 'Bambara', endonym: 'Bamanankan', script: 'latn',
    family: 'Niger-Congo', branch: 'Mande', speakers: 15,
    regions: [{ name: 'southern Mali', units: ['ML-1', 'ML-2', 'ML-3', 'ML-4', 'ML-BKO'] }],

  },
  {
    code: 'gaz', name: 'Oromo', endonym: 'Afaan Oromoo', script: 'latn',
    family: 'Afro-Asiatic', branch: 'Cushitic', speakers: 37,
    regions: [{ name: 'Oromia', units: ['ET-OR'] }],

  },
  {
    code: 'plt', name: 'Malagasy', endonym: 'Malagasy', script: 'latn',
    family: 'Austronesian', branch: 'Malayo-Polynesian', speakers: 25,
    regions: [{ name: 'Madagascar', countries: ['MG'] }],
  },
  {
    code: 'jav', name: 'Javanese', endonym: 'basa Jawa', script: 'latn',
    family: 'Austronesian', branch: 'Malayo-Polynesian', speakers: 82,
    regions: [{ name: 'central and eastern Java', units: ['ID-JT', 'ID-JI', 'ID-YO'] }],

  },
  {
    code: 'sun', name: 'Sundanese', endonym: 'basa Sunda', script: 'latn',
    family: 'Austronesian', branch: 'Malayo-Polynesian', speakers: 32,
    regions: [{ name: 'western Java', units: ['ID-JB', 'ID-BT'] }],

  },
  {
    code: 'ceb', name: 'Cebuano', endonym: 'Binisaya', script: 'latn',
    family: 'Austronesian', branch: 'Malayo-Polynesian', speakers: 20,
    regions: [
      { name: 'the Visayas', units: ['PH-CEB', 'PH-BOH', 'PH-NER', 'PH-NEC', 'PH-LEY', 'PH-SLE'] },
      { name: 'northern Mindanao', units: ['PH-MSR', 'PH-MSC', 'PH-BUK', 'PH-AGN', 'PH-AGS', 'PH-SUN', 'PH-SUR', 'PH-DAV', 'PH-DAS', 'PH-DAO'] },
    ],

  },
  {
    code: 'ilo', name: 'Ilocano', endonym: 'Ilokano', script: 'latn',
    family: 'Austronesian', branch: 'Malayo-Polynesian', speakers: 9,
    regions: [{ name: 'the Ilocos coast', units: ['PH-ILN', 'PH-ILS', 'PH-LUN', 'PH-ABR', 'PH-PAN'] }],

  },
  {
    code: 'kmr', name: 'Kurmanji Kurdish', endonym: 'Kurmancî', script: 'latn',
    family: 'Indo-European', branch: 'Iranian', speakers: 15,
    regions: [
      { name: 'the Kurdish southeast', units: ['TR-21', 'TR-47', 'TR-63', 'TR-72', 'TR-73', 'TR-30', 'TR-65', 'TR-13', 'TR-12', 'TR-49', 'TR-02', 'TR-56', 'TR-62'] },
      { name: 'the Syrian northeast', units: ['SY-HA'] },
    ],
  },
  {
    code: 'tuk', name: 'Turkmen', endonym: 'türkmençe', script: 'latn',
    family: 'Turkic', branch: 'Oghuz', speakers: 7,
    regions: [{ name: 'Turkmenistan', countries: ['TM'] }],
  },
  {
    code: 'tet', name: 'Tetum', endonym: 'Tetun', script: 'latn',
    family: 'Austronesian', branch: 'Malayo-Polynesian', speakers: 0.5,
    regions: [{ name: 'Timor-Leste', countries: ['TL'] }],
  },
  {
    code: 'mri', name: 'Maori', endonym: 'te reo Māori', script: 'latn',
    family: 'Austronesian', branch: 'Polynesian', speakers: 0.19,
    regions: [{ name: 'Aotearoa', countries: ['NZ'] }],
  },
  {
    code: 'smo', name: 'Samoan', endonym: 'gagana Samoa', script: 'latn',
    family: 'Austronesian', branch: 'Polynesian', speakers: 0.5,
    regions: [{ name: 'the Samoan islands', countries: ['WS'] }],
  },
  {
    code: 'ton', name: 'Tongan', endonym: 'lea faka-Tonga', script: 'latn',
    family: 'Austronesian', branch: 'Polynesian', speakers: 0.19,
    regions: [{ name: 'the Tongan islands', countries: ['TO'] }],
  },
  {
    code: 'fij', name: 'Fijian', endonym: 'Na Vosa Vakaviti', script: 'latn',
    family: 'Austronesian', branch: 'Oceanic', speakers: 0.65,
    regions: [{ name: 'the Fijian islands', countries: ['FJ'] }],
  },
  {
    code: 'haw', name: 'Hawaiian', endonym: 'ʻōlelo Hawaiʻi', script: 'latn',
    family: 'Austronesian', branch: 'Polynesian', speakers: 0.025,
    regions: [{ name: 'Hawaii', units: ['US-HI'] }],

  },
  {
    code: 'tpi', name: 'Tok Pisin', endonym: 'Tok Pisin', script: 'latn',
    family: 'Creole', branch: 'English-based', speakers: 4,
    regions: [{ name: 'Papua New Guinea', countries: ['PG'] }],
  },
  {
    code: 'que', name: 'Quechua', endonym: 'Runasimi', script: 'latn',
    family: 'Quechuan', branch: 'Quechua II', speakers: 8,
    regions: [
      { name: 'the southern Peruvian Andes', units: ['PE-CUS', 'PE-PUN', 'PE-AYA', 'PE-APU', 'PE-HUV'] },
      { name: 'the Bolivian valleys', units: ['BO-C', 'BO-P', 'BO-H'] },
    ],

  },
  {
    code: 'aym', name: 'Aymara', endonym: 'Aymar aru', script: 'latn',
    family: 'Aymaran', branch: 'Aymaran', speakers: 1.7,
    regions: [{ name: 'the Bolivian altiplano', units: ['BO-L', 'BO-O'] }, { name: 'Puno', units: ['PE-PUN'] }],

  },
  {
    code: 'grn', name: 'Guarani', endonym: 'avañeʼẽ', script: 'latn',
    family: 'Tupian', branch: 'Tupi-Guarani', speakers: 6,
    regions: [{ name: 'Paraguay', countries: ['PY'] }],
  },
  {
    code: 'hat', name: 'Haitian Creole', endonym: 'kreyòl ayisyen', script: 'latn',
    family: 'Creole', branch: 'French-based', speakers: 12,
    regions: [{ name: 'Haiti', countries: ['HT'] }],
  },
  {
    code: 'pap', name: 'Papiamento', endonym: 'Papiamentu', script: 'latn',
    family: 'Creole', branch: 'Iberian-based', speakers: 0.3,
    regions: [{ name: 'the leeward islands', countries: ['AW', 'CW'] }],
  },
  {
    code: 'kal', name: 'Greenlandic', endonym: 'kalaallisut', script: 'latn',
    family: 'Eskimo-Aleut', branch: 'Inuit', speakers: 0.056,
    regions: [{ name: 'Greenland', countries: ['GL'] }],
  },
  {
    code: 'yue', name: 'Cantonese', endonym: '廣東話', script: 'hans',
    family: 'Sino-Tibetan', branch: 'Sinitic', speakers: 85,
    regions: [{ name: 'Guangdong', units: ['CN-GD'] }, { name: 'Hong Kong', countries: ['HK'] }],

  },
];

export const LANGUAGES = LANGUAGE_ROWS;

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
