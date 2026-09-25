/**
 * What gives each language away.
 *
 * The round asks which language, and a player who knows the answer
 * usually knows it from two or three concrete things: a letter the
 * neighbouring language does not have, a copula spelled differently, a
 * word for tea. This is that knowledge, written down, so the reveal can
 * point at it instead of only naming the answer. Getting a round wrong
 * and being shown the letter that would have settled it is the whole
 * difference between a quiz and a game you get better at.
 *
 * A marker is a literal string and a note saying what it rules out.
 * `text` has to appear in the sentence for the reveal to point at it,
 * so these are matched against the sample and only the ones actually on
 * screen are shown.
 *
 * **Server only, for the same reason the corpus is.** A marker is a
 * string that identifies a language, so shipping the table to the
 * browser would let a player match the sentence on screen against it
 * and read off the answer before guessing. The reveal gets its markers
 * from the guess response, never from the round.
 *
 * Four rules, all checked by __tests__/geo/markers.test.js rather than
 * trusted:
 *
 * 1. **Every sample carries at least one marker**, so no round reveals
 *    with nothing to teach.
 * 2. **No marker appears in another language written in the same
 *    script.** A feature shared with the language you would confuse it
 *    with is not a marker, it is a red herring. Across scripts the
 *    check is pointless, because the script already answered it.
 * 3. **Every note rules something out.** It names the language the
 *    feature beats, or says outright that nothing else does this.
 * 4. **Every sample carries at least one marker that clears rule 3 on
 *    its own**, because the reveal can only point at what is on screen.
 *
 * Rules 3 and 4 are there because 1 and 2 turned out to be too easy to
 * pass. A Wolof round came up reading `Dafay dem liggeey ci tank bes bu
 * nekk`, and the only marker in it was `tank`, noted as "foot, with a
 * grave accent marking an open vowel". True, and Wolof, and in no
 * rival's three sentences, and worth nothing: grave accents are in
 * French, Italian, Portuguese, Catalan and Vietnamese, so a player who
 * spotted it was no closer to Senegal. Meanwhile the same sentence was
 * carrying `Dafay`, the verb focus conjugation, and `bes bu nekk`, noun
 * class agreement in the open. Those are the answer. A note that only
 * describes what a letter looks like is not a marker, and naming your
 * own language is not ruling anything out.
 *
 * Where a script belongs to one language in the pool the script is the
 * marker, and those notes are free to be about the alphabet.
 *
 * A note never describes the pool. "No other language here does this"
 * and "in this pool Greek is one answer" told a player what else could
 * come up, and what the game covers is kept secret
 * (app/lib/geo/script.js). A note compares the language with named
 * languages, or says what is true of it anywhere.
 */

export const MARKERS = {
  // Devanagari, which is five answers and the hardest group in the pool.
  hin: [
    { text: 'मैंने', note: 'The ergative ने on a past transitive subject. Marathi and Punjabi do it too, Nepali and Bengali never do.' },
    { text: 'है', note: 'The copula. Marathi says आहे, Nepali छ, Maithili छथि, Bhojpuri बा.' },
    { text: 'चाय', note: 'Tea. Marathi चहा, Nepali चिया, Bhojpuri and Maithili चाह.' },
  ],
  mar: [
    { text: 'चहा', note: 'Tea. Hindi चाय, Nepali चिया.' },
    { text: 'जातो', note: 'Present tense in one word, agreeing in gender. Hindi needs two: जाता है.' },
    { text: 'माहीत', note: 'Known. Hindi पता, Nepali थाहा.' },
  ],
  npi: [
    { text: 'छैन', note: 'The negative copula. Hindi negates with नहीं and a separate verb.' },
    { text: 'जान्छ', note: 'Present tense built on छ. Hindi would be जाता है, Marathi जातो.' },
    { text: 'थियो', note: 'Was. Hindi था, Marathi होता.' },
    { text: 'चिया', note: 'Tea. Hindi चाय, Marathi चहा.' },
  ],
  bho: [
    { text: 'जाला', note: 'Third person present in one word. Hindi जाता है.' },
    { text: 'पिअनी', note: 'A first person past in -नी, which no standard Hindi has.' },
    { text: 'बहुते', note: 'The emphatic -e stuck on an adverb. Hindi writes बहुत and stops there.' },
  ],
  mai: [
    { text: 'छल', note: 'Was, built on छ like Nepali but inflected differently.' },
    { text: 'छथि', note: 'An honorific present. Maithili marks respect in the verb more finely than Hindi.' },
    { text: 'पिलहुँ', note: 'First person past in -हुँ. Hindi writes पिया, Bhojpuri पिअनी: one verb, three endings.' },
    { text: 'जाइत', note: 'A participle in -इत where Hindi has -ता.' },
  ],

  // Bengali script, which is two answers and one letter apart.
  ben: [
    { text: 'র', note: 'Plain র. Assamese writes its r as ৰ, with a stroke through the middle, and that one letter separates the two.' },
    { text: 'আমি', note: 'I. Assamese says মই, which is the other half of the same tell.' },
    { text: 'খেয়েছি', note: 'A perfect in -ছি. Assamese ends the same tense in -লোঁ.' },
  ],
  asm: [
    { text: 'ৰ', note: 'Assamese ৰ, the r with a stroke. Bengali writes র, so this one letter tells the two apart.' },
    { text: 'মই', note: 'I. Bengali says আমি, and the two languages differ more in the small words than the big ones.' },
    { text: 'তেওঁ', note: 'He or she, honorific, with a candrabindu Bengali does not use here.' },
    { text: 'লৈ', note: 'A postposition meaning towards. Bengali would use এ.' },
  ],

  pan: [
    { text: 'ੱ', note: 'The addak, which doubles the next consonant. Gurmukhi is written for Punjabi and nothing else, so the alphabet settles it before the word does.' },
    { text: 'ਹੈ', note: 'The copula, the same word as Hindi है in a different script.' },
  ],
  guj: [
    { text: 'છે', note: 'The copula. Gujarati drops the headline stroke that runs along the top of Devanagari.' },
    { text: 'ં', note: 'Anusvara doing heavy work; Gujarati nasalises where Hindi would write a full न.' },
  ],
  ory: [
    { text: 'ଣ', note: 'Odia letters are rounded at the top, a shape that comes from writing on palm leaf without tearing it.' },
    { text: 'ମୁଁ', note: 'I. Odia keeps a nasal vowel here that Bengali writes differently.' },
    { text: 'ଯାଆନ୍ତି', note: 'An honorific present. Odia conjugates for respect the way Maithili does and Bengali does not.' },
  ],

  // Arabic script, seven answers, and the added letters do most of the work.
  urd: [
    { text: 'تھی', note: 'Was. Aspiration written with ھ, which Indo-Aryan needs and Arabic and Persian do not. Western Punjabi says سی.' },
    { text: 'چائے', note: 'Tea. Western Punjabi writes چاہ, Persian چای, Arabic شاي.' },
    { text: 'بہت', note: 'Very. Western Punjabi says بہوں: the letters are shared, the words are not.' },
    { text: 'جاتا', note: 'Goes. Western Punjabi جاندا, and that d is the whole difference.' },
  ],
  snd: [
    { text: 'ڄ', note: 'An implosive j. Sindhi has four implosives and a 52 letter alphabet, the longest in this script.' },
    { text: 'ڪ', note: 'Sindhi writes k as ڪ where Urdu and Persian write ک.' },
    { text: 'ويندو', note: 'Will go. Sindhi builds the future on -ندو; Urdu needs a second word, جائے گا.' },
  ],
  arb: [
    { text: 'إلى', note: 'To. Written with hamza under alif, an Arabic spelling convention Persian and Urdu drop.' },
    { text: 'هذا', note: 'This. Persian says این, Urdu یہ.' },
  ],
  pes: [
    { text: 'می‌', note: 'The present prefix mi-, which Persian joins to the verb with a zero width non joiner. Arabic and Urdu have no such prefix.' },
    { text: 'خوردم', note: 'A first person past in -م. Persian has no ٹ, ڈ or ے, which is what separates it from Urdu.' },
  ],
  pbu: [
    { text: 'ښ', note: 'A retroflex fricative written with a dot above and below. Pashto only.' },
    { text: 'ډ', note: 'A retroflex d. Pashto marks retroflexion with a small circle, Urdu with a small ط.' },
    { text: 'ځ', note: 'Another Pashto letter with no equivalent in Persian or Arabic.' },
  ],
  ckb: [
    { text: 'ڕ', note: 'A rolled r written with a small v. Sorani Kurdish only.' },
    { text: 'ێ', note: 'Kurdish writes its vowels out in full, which is why the text looks longer than Arabic or Persian.' },
  ],
  uig: [
    { text: 'ڭ', note: 'Ng, a Turkic sound with a three dot letter of its own.' },
    { text: 'ۈ', note: 'A front rounded vowel. Uyghur writes every vowel out; Arabic, Persian and Urdu leave the short ones off the page, which is why their words look barer.' },
  ],

  tam: [
    { text: 'குடித்தேன்', note: 'I drank, one word, with the person on the end. Tamil marks person in the verb; Malayalam has stopped doing it.' },
    { text: 'ற', note: 'Tamil uses one letter per place of articulation and no separate voiced series, so its alphabet is the shortest of the southern four.' },
  ],
  tel: [
    { text: 'ఉ', note: 'Telugu letters hang from a tick on the top left. Kannada is the closest shape and its tick sits differently.' },
    { text: 'ను', note: 'A first person ending in -ను. Kannada, the script this one gets mistaken for, ends the same verb -ದೆ.' },
  ],
  kan: [
    { text: 'ಿ', note: 'Kannada and Telugu are close cousins in shape; Kannada draws a fuller, rounder head on most letters.' },
    { text: 'ಾನೆ', note: 'A third person present in -ಾನೆ. Telugu, the neighbouring script, writes -ాడు.' },
  ],
  mal: [
    { text: 'ഞ', note: 'Malayalam piles consonants into single dense shapes, more than any other southern script.' },
    { text: 'ൻ', note: 'A chillu, a bare consonant with no vowel. Malayalam writes these as their own letters.' },
  ],
  sin: [
    { text: 'ඔහු', note: 'He. Sinhala is round for the same reason Odia is, palm leaf, but the two alphabets share no letters.' },
    { text: 'මම', note: 'I, said twice over: Sinhala doubles the syllable where Hindi says मैं once.' },
  ],

  // Cyrillic, six answers. The extra letters separate the Turkic and
  // Mongolic ones; the Slavic three come apart on words.
  rus: [
    { text: 'Сегодня', note: 'Today. Ukrainian Сьогодні, Bulgarian Днес.' },
    { text: 'каждый', note: 'Every. Ukrainian кожен, Serbian сваки.' },
    { text: 'куда', note: 'Where to. Ukrainian куди, Belarusian куды, Bulgarian къде.' },
  ],
  ukr: [
    { text: 'Сьогодні', note: 'Today, with the soft sign inside the word. Russian Сегодня.' },
    { text: 'щодня', note: 'Daily in one word. Russian needs каждый день.' },
    { text: 'куди', note: 'Where to. Russian куда, and Ukrainian has no ы anywhere.' },
  ],
  bul: [
    { text: 'Тази', note: 'This, feminine. Bulgarian dropped noun cases; of the Slavic languages only Macedonian did the same.' },
    { text: 'всеки', note: 'Every. Macedonian секој, Serbian сваки, Russian каждый.' },
    { text: 'Той', note: 'He. Russian Он, Serbian Он.' },
  ],
  srp: [
    { text: 'ћ', note: 'A soft ch, one of five letters Vuk added to write Serbian. Russian and Bulgarian have no such letter.' },
    { text: 'сваки', note: 'Every. Russian каждый, Bulgarian всеки.' },
    { text: 'посао', note: 'Work. Russian and Bulgarian write работа; Serbian turned a final l into o, and this is what it left.' },
  ],
  kaz: [
    { text: 'қ', note: 'A deep k. Kazakh adds nine letters to Russian Cyrillic for Turkic sounds.' },
    { text: 'ұ', note: 'A barred u, Kazakh only. Mongolian has ү but not ұ.' },
  ],
  mon: [
    { text: 'Өнөө', note: 'Today. Mongolian Cyrillic adds only ө and ү, so it looks like Russian with two strangers in it.' },
    { text: 'хүйтэн', note: 'Cold. Mongolian and Kazakh share ө and ү and share no words at all.' },
    { text: 'Тэр', note: 'He or she. Russian Он, Kazakh Ол.' },
    { text: 'явган', note: 'On foot. Mongolian puts the verb last, always, which Russian does not.' },
  ],

  ell: [{ text: 'Σ', note: 'Sigma. The Greek alphabet is written for Greek and nothing else today, so the letters settle it.' }, { text: 'Πηγαίνει', note: 'Goes. Greek puts the verb first and needs no pronoun, because the ending already carries it.' }],
  heb: [{ text: 'ש', note: 'Hebrew, written right to left with no vowels marked.' }, { text: 'ה', note: 'The definite article, one letter glued to the front. Arabic needs two for the same job, ال.' }],
  kat: [{ text: 'ღ', note: 'Georgian has no capitals and no other language uses this alphabet.' }, { text: 'ძ', note: 'Georgian distinguishes three kinds of stop, which is why it needs 33 letters.' }],
  hye: [{ text: '։', note: 'The Armenian full stop, two dots. Armenian punctuates with marks nobody else uses.' }, { text: 'օ', note: 'Armenian, a 36 letter alphabet invented in one go in the fifth century and used for one language.' }],

  amh: [
    { text: 'ዛሬ', note: 'Today. Tigrinya says ሎሚ, and the two languages share an alphabet and not much else.' },
    { text: 'እሱ', note: 'He. Tigrinya writes ንሱ: same script, one letter apart, different language.' },
  ],
  tir: [
    { text: 'ሎሚ', note: 'Today. Amharic says ዛሬ, which is the fastest way to tell these two apart.' },
    { text: 'ንሱ', note: 'He. Amharic writes እሱ, with a different first character.' },
    { text: 'ኣ', note: 'Tigrinya prefers the ኣ series where Amharic writes አ.' },
  ],

  tha: [{ text: 'ฉัน', note: 'I. Thai and Lao look alike; Thai keeps more Sanskrit spelling and so more silent letters.' }, { text: 'เดิน', note: 'To walk. Thai writes five tones with four marks and no spaces between words.' }],
  lao: [{ text: 'ຂ້ອຍ', note: 'I. Lao spells words as they sound, so it has fewer letters than Thai and rounder shapes.' }, { text: 'ໄປ', note: 'To go. Lao and Thai share this word; Lao spells it shorter, because it dropped the Sanskrit spellings Thai kept.' }],
  khm: [{ text: '។', note: 'The Khmer full stop. Khmer has no tones and the longest alphabet in the world.' }, { text: 'ខ្ញុំ', note: 'I. Khmer stacks consonants under each other, which is why one syllable can be three storeys tall.' }],
  mya: [{ text: '၊', note: 'Burmese is written in circles because palm leaf tears along a straight line.' }, { text: 'တယ်', note: 'A sentence final marker. Burmese circles sit on the line in a row, where Khmer builds upwards.' }],

  cmn: [
    { text: '他', note: 'He. A sentence made only of characters, with no kana threaded through it, is Chinese rather than Japanese.' },
    { text: '今天', note: 'Today. Cantonese writes 今朝, and the pair is one of the quickest tells between the two.' },
    { text: '不知道', note: 'Do not know. Cantonese 唔知, with characters Mandarin does not use.' },
    { text: '喝', note: 'Drink. Cantonese 飲, which is the older word and the one Mandarin replaced.' },
  ],
  jpn: [{ text: 'の', note: 'Hiragana. Kana between the kanji is what separates Japanese from Chinese at a glance.' }, { text: 'は', note: 'The topic particle, in kana. Kana threaded between the kanji is what separates Japanese from Chinese at a glance.' }],
  kor: [{ text: '는', note: 'Hangul, syllables built from letters in blocks. Nothing else looks like it.' }, { text: '다', note: 'Every plain sentence ends in this syllable. Korean has no Chinese characters in ordinary modern text.' }],
  // Latin, which is most of the pool and where the differences are
  // smallest. A shared alphabet means the tell is usually one letter
  // nobody else uses, or one word the neighbour spells differently.
  spa: [
    { text: 'hacía', note: 'Was doing. Asturian facía, Galician facía: Spanish is the one that turned that f into an h.' },
    { text: 'días', note: 'Days, with the accent. Portuguese writes dias without one.' },
    { text: 'adónde', note: 'Where to. Portuguese aonde, Catalan on.' },
  ],
  por: [
    { text: 'manhã', note: 'Morning, with a nasal a. Spanish has no tilde over a vowel, only over n.' },
    { text: 'trabalho', note: 'Work. Spanish trabajo: where Portuguese has lh, Spanish has j.' },
    { text: 'aonde', note: 'Where to. Spanish adónde.' },
  ],
  ita: [
    { text: 'così', note: 'So. Italian marks final stress with a grave, which Spanish never does.' },
    { text: 'bevuto', note: 'A past participle in -uto, an Italian ending Spanish and Portuguese lack.' },
    { text: 'giorni', note: 'Days. Spanish días, French jours.' },
    { text: 'piedi', note: 'Feet. Italian ends almost every word in a vowel; Spanish and Portuguese end them in s, n and r constantly.' },
  ],
  ron: [
    { text: 'ă', note: 'A breve. Romanian is a Romance language with Slavic neighbours and its own vowels.' },
    { text: 'ș', note: 'S with a comma below, not a cedilla. Turkish writes ş, which is a different letter.' },
    { text: 'ț', note: 'T with a comma below, a Romanian letter. Italian, Spanish and French have nothing like it.' },
  ],
  fra: [
    { text: 'faisait', note: 'An imperfect with three vowels for one sound. Spanish and Italian never write ai for an e sound.' },
    { text: 'bureau', note: 'The -eau ending, three letters for one sound. Spanish and Italian would write a plain o.' },
    { text: 'où', note: 'Where. The only French word with a grave over u.' },
  ],
  cat: [
    { text: 'vaig', note: 'A past built with the verb to go: vaig prendre is I took. Spanish and French have nothing like it.' },
    { text: 'així', note: 'So. Spanish así, one letter shorter.' },
    { text: 'feina', note: 'Work. Spanish trabajo, French travail.' },
  ],
  deu: [
    { text: 'ß', note: 'The sharp s. Only German has it, and Switzerland does not.' },
    { text: 'getrunken', note: 'Drunk. Dutch builds participles the same way but writes gedronken, Afrikaans gedrink: the ge- is shared, the u is not.' },
    { text: 'wohin', note: 'Where to, one word. Dutch waarheen, Afrikaans waarheen.' },
  ],
  nld: [
    { text: 'Vanochtend', note: 'This morning. Afrikaans says Vanoggend, and the ch against gg is the split.' },
    { text: 'Hij', note: 'He. Afrikaans Hy: Dutch keeps the ij, Afrikaans cut it to y.' },
  ],
  afr: [
    { text: 'Vanoggend', note: 'This morning. Dutch Vanochtend.' },
    { text: 'baie', note: 'Very, from Malay. Dutch would say erg or heel.' },
    { text: 'Hy', note: 'He. Dutch writes Hij: Afrikaans cut the ij to y everywhere it appeared.' },
    { text: 'gedrink', note: 'Afrikaans has one past tense, built with het plus ge-. Dutch still has dronk.' },
  ],
  swe: [
    { text: 'mycket', note: 'Very. Danish meget, Norwegian veldig.' },
    { text: 'drack', note: 'Drank. Danish drak, Norwegian and Icelandic drakk.' },
    { text: 'jobbet', note: 'The job, with the definite article stuck on as -et. Norwegian jobben.' },
    { text: 'varje', note: 'Every. Danish and Norwegian both say hver.' },
  ],
  dan: [
    { text: 'meget', note: 'Very. Swedish mycket, Norwegian veldig.' },
    { text: 'koldt', note: 'Cold. Norwegian writes kaldt and Swedish kallt: one word, three spellings, three languages.' },
    { text: 'arbejde', note: 'Work. Norwegian arbeid, Swedish arbete. Danish keeps the j.' },
  ],
  nob: [
    { text: 'veldig', note: 'Very. Danish meget, Swedish mycket.' },
    { text: 'kaldt', note: 'Cold. Danish koldt, Swedish kallt.' },
    { text: 'jobben', note: 'The job, definite in -en. Swedish jobbet.' },
  ],
  isl: [
    { text: 'ég', note: 'I. Norwegian, Danish and Swedish all say jeg or jag.' },
    { text: 'mjög', note: 'Very. Icelandic kept words Norwegian, Danish and Swedish dropped, and writes them with letters those three gave up.' },
    { text: 'gengur', note: 'Walks. Icelandic still inflects verbs for person, which the others gave up.' },
    { text: 'vinnuna', note: 'A noun in the accusative. Icelandic has four cases; Danish has none.' },
  ],
  fin: [
    { text: 'joten', note: 'So. Finnish is not Indo-European and shares almost no words with its neighbours.' },
    { text: 'kuumaa', note: 'Hot, in the partitive. Estonian doubles vowels too, but lost this case ending and would stop at kuuma.' },
    { text: 'kävelee', note: 'Walks. Estonian would say kõnnib or käib.' },
    { text: 'päivä', note: 'Day. Estonian päev: Estonian has worn its endings down, Finnish has not.' },
  ],
  est: [
    { text: 'seetõttu', note: 'Therefore. Estonian and Finnish are close cousins, and this word exists in neither the other way round.' },
    { text: 'jalgsi', note: 'On foot. Finnish says jalan: the two are related, and Estonian has worn its endings shorter.' },
    { text: 'tööl', note: 'At work, marked by a case ending. Finnish, the near twin, says töissä, and has no õ.' },
  ],
  hun: [
    { text: 'ezért', note: 'Therefore. Hungarian is related to Finnish and Estonian and to nothing around it.' },
    { text: 'forró', note: 'Hot. Hungarian marks long vowels with an acute even on o, so ó sits where Polish or Czech would write a plain o.' },
    { text: 'gyalog', note: 'On foot. Gy is a letter in its own right in Hungarian, as are ly, ny and ty; Finnish has none of them.' },
    { text: 'dolgozni', note: 'To work. Every Hungarian infinitive ends -ni; Finnish infinitives end in -a or -ä.' },
  ],
  pol: [
    { text: 'ę', note: 'A nasal e with a hook. Polish and Lithuanian both use hooks, for different sounds.' },
    { text: 'Codziennie', note: 'Daily, in one word. Czech needs two, každý den, and spells the sounds with haceks rather than digraphs.' },
  ],
  ces: [
    { text: 'jsem', note: 'I am. Czech squeezes the vowel out of this word; Slovak keeps it as som, Polish as jestem.' },
    { text: 'pěšky', note: 'On foot. Polish pieszo, Croatian pješice.' },
    { text: 'horký', note: 'Hot. The ý is a long vowel; Polish marks no vowel length at all.' },
  ],
  hrv: [
    { text: 'Jutros', note: 'This morning. The same word as Serbian, in Latin letters rather than Cyrillic.' },
    { text: 'popio', note: 'Drank up, with l turned to o at the end. Czech would keep the l.' },
    { text: 'pješice', note: 'On foot. Czech pěšky, Polish pieszo.' },
  ],
  lit: [
    { text: 'į', note: 'I with a hook. Lithuanian keeps endings older than any other living Indo-European language.' },
    { text: 'ė', note: 'E with a dot. Polish has hooks but no dotted e.' },
    { text: 'pėsčiomis', note: 'On foot, in the instrumental plural. Latvian, the only other Baltic language, lost this ending and says kajam.' },
    { text: 'kasdien', note: 'Daily, in one word. Polish needs two: codziennie is built the same way but spelled nothing like it.' },
  ],
  sqi: [
    { text: 'prandaj', note: 'Therefore. Albanian shares its alphabet with Italian across the water and almost none of its words.' },
    { text: 'shkon', note: 'Goes. Albanian writes sh and ç, which look Italian, over a vocabulary that is not.' },
    { text: 'çdo', note: 'Every. Turkish also has ç, but Albanian pairs it with ë, which Turkish does not have.' },
  ],
  eus: [
    { text: 'zuen', note: 'An auxiliary that agrees with subject and object at once. Basque is related to nothing.' },
    { text: 'Egunero', note: 'Daily, from egun plus -ero. Spanish, which surrounds Basque on every side, needs three words: todos los días.' },
    { text: 'oinez', note: 'On foot, from oin plus -z. Basque puts on the end of the noun what Spanish puts in front of it: a pie.' },
    { text: 'lanera', note: 'To work. Basque stacks the case on the end of the noun where Spanish puts a word in front: al trabajo.' },
  ],
  cym: [
    { text: 'Roedd', note: 'Was. Welsh and Irish both put the verb first; what separates them on the page is ll, dd, and w used as a vowel.' },
    { text: 'felly', note: 'So. Welsh doubles l and f to make different sounds; Irish marks the same kind of change by adding an h after the letter.' },
    { text: 'cerdded', note: 'To walk. Dd is one letter, the th in this. Irish writes that sound dh.' },
    { text: 'gwaith', note: 'Work. Welsh uses w as a vowel on its own, which English does only in words borrowed from Welsh.' },
  ],
  tur: [
    { text: 'ğ', note: 'A soft g, which lengthens the vowel before it and is silent. Azerbaijani does not use it.' },
    { text: 'iyor', note: 'The present continuous. Azerbaijani builds the same tense with -ir.' },
    { text: 'yüzden', note: 'Because of. Turkish and Azerbaijani share most of their grammar and little of this vocabulary.' },
  ],
  azj: [
    { text: 'ə', note: 'A schwa taken from the phonetic alphabet, and the single quickest way to tell Azerbaijani from Turkish.' },
    { text: 'gedir', note: 'Goes. Turkish builds the same tense as gidiyor, which is the other half of this tell.' },
  ],
  uzn: [
    { text: 'shuning', note: 'Uzbek writes sh and ch as digraphs, where Turkish has ş and ç.' },
    { text: 'ichdim', note: 'I drank. Uzbek writes ch where Turkish writes ç and Azerbaijani writes ç too.' },
    { text: 'boradi', note: 'Goes. Uzbek keeps -adi where Turkish has -iyor and Azerbaijani -ir.' },
    { text: 'ertalab', note: 'In the morning. Uzbek took this from Persian, as it did much of its vocabulary.' },
  ],
  vie: [
    { text: 'ờ', note: 'A vowel with a horn and a tone mark stacked on it. French and Portuguese never put two marks on one letter.' },
    { text: 'ấy', note: 'That. Vietnamese writes each syllable as its own word, so a line breaks into short pieces, unlike Tagalog or Indonesian.' },
  ],
  ind: [
    { text: 'udaranya', note: 'The air. Indonesian and Malay are the same language in most sentences; the vocabulary is where they part.' },
    { text: 'dingin', note: 'Cold. Malay would say sejuk.' },
    { text: 'ke kantor', note: 'To the office. Malay says ke pejabat, Javanese menyang kantor, Sundanese ka kantor: one preposition apart from each of them.' },
    { text: 'hangat', note: 'Warm, of a drink. Malay would say panas for the same cup of tea.' },
  ],
  zsm: [
    { text: 'cuaca', note: 'The weather. Indonesian would more likely say udara here.' },
    { text: 'sejuk', note: 'Cool. Indonesian says dingin, and this pair is the clearest split between the two.' },
    { text: 'pejabat', note: 'Office. Indonesian kantor, from Dutch. Malaysia borrowed from English and Arabic where Indonesia borrowed from Dutch.' },
  ],
  tgl: [
    { text: 'Napakalamig', note: 'Very cold, in one word. Indonesian and Malay need two: sangat dingin.' },
    { text: 'ngayong', note: 'Ng is one letter in Tagalog and can open a word. Vietnamese words can start with ng too, but Vietnamese stacks accents on nearly every syllable.' },
    { text: 'Naglalakad', note: 'Is walking: the stem syllable said twice marks it in progress. Indonesian and Malay use ber- and meng- instead.' },
    { text: 'araw-araw', note: 'Every day, the word for day doubled. Indonesian doubles nouns too, but writes hari-hari.' },
  ],
  swh: [
    { text: 'nilikunywa', note: 'I drank in one word: ni- for I, -li- for past, -kunywa for drink. Zulu builds the same way but says ngiphuze.' },
    { text: 'kulikuwa', note: 'There was, with the place class on the verb. Zulu agrees the same way, but marks the past with -a- where Swahili uses -li-.' },
    { text: 'kazini', note: 'At work: kazi plus -ni for place. Zulu marks the same idea with a prefix, emsebenzini.' },
    { text: 'Yeye', note: 'He or she. Swahili has no grammatical gender.' },
  ],
  hau: [
    { text: 'ƙ', note: 'A hooked k, said with the throat shut. Pular writes hooked letters too, but has no k among them.' },
    { text: 'saboda', note: 'Because, from Arabic. Hausa took its abstract words from Arabic and kept its own sounds.' },
    { text: 'shayi', note: 'Tea, from Arabic shai, as in most languages that got it overland rather than by sea.' },
    { text: 'kowace', note: 'Every, agreeing in gender. Hausa has two genders where Swahili has a dozen noun classes.' },
  ],
  yor: [
    { text: 'ṣ', note: 'S with a dot under it. Igbo writes dots below as well, but never puts a tone accent on top of them the way Yoruba does.' },
    { text: 'ẹ', note: 'E with a dot under and a tone mark above. Two systems at once, which only Yoruba runs in ordinary writing.' },
    { text: 'gan-an', note: 'Very. Yoruba writes a hyphen where a syllable repeats; Hausa would say sosai.' },
  ],
  som: [
    { text: 'waxaan', note: 'A focus marker put in front of whatever is being asserted. A Somali statement needs one before it can start; Swahili has nothing like it.' },
    { text: 'sidaas', note: 'So. Somali doubles vowels for length. Oromo, across the border, doubles consonants as well, and writes no x or c.' },
    { text: 'ayuu', note: 'A focus marker fused with the subject. Somali builds sentences round waxaa and ayaa, and Swahili has no word that works this way.' },
    { text: 'shaqada', note: 'The work, definite in -da hung on the end. Oromo marks the same idea with -ni and -ti.' },
  ],
  zul: [
    { text: 'Namhlanje', note: 'Today. Xhosa writes it the same, so this one narrows it to two: the clicks c, q and x are what separate them.' },
    { text: 'ngiphuze', note: 'I drank, with ngi- glued to the front. Swahili does that job with ni-, Xhosa with ndi-.' },
    { text: 'ngezinyawo', note: 'By foot, with the class prefix pulled through the whole sentence. Swahili agrees the same way but keeps kwa separate: kwa miguu.' },
  ],
  // Added 2026-09-15 with the languages they mark.
  mkd: [
    { text: 'Утрово', note: 'This morning, with the demonstrative stuck on the end as -во. Only Macedonian does that.' },
    { text: 'испив', note: 'I drank. Bulgarian writes изпих, with з where Macedonian has с.' },
    { text: 'секој', note: 'Every. Bulgarian всеки, Serbian сваки.' },
    { text: 'пешки', note: 'On foot. Bulgarian пеша.' },
    { text: 'овој', note: 'This. Macedonian and Bulgarian both dropped noun cases; only Macedonian puts the demonstrative on the end of the noun as well.' },
  ],
  bel: [
    { text: 'ў', note: 'A short u that exists as its own letter. Russian and Ukrainian have no such thing.' },
    { text: 'гарбат', note: 'Tea, from Polish herbata rather than from Chinese cha. Russian and Ukrainian both say чай.' },
    { text: 'ведаю', note: 'I know. Russian знаю, Ukrainian знаю.' },
    { text: 'кожны', note: 'Every. Russian каждый, Ukrainian кожен: Belarusian sits between the two and matches neither.' },
  ],
  tgk: [
    { text: 'ӯ', note: 'A Cyrillic letter invented for Tajik. This is Persian written in Cyrillic, which is why the words look Iranian and the alphabet does not.' },
    { text: 'ҷ', note: 'J, added to Cyrillic for a sound Russian does not have.' },
    { text: 'ҳ', note: 'H with a descender. Tajik added six letters to Cyrillic; Kazakh and Kyrgyz added different ones.' },
  ],
  kir: [
    { text: 'эртең менен', note: 'In the morning, two words. Kazakh says таңертең as one.' },
    { text: 'ошондуктан', note: 'Therefore. Kazakh сондықтан.' },
    { text: 'жөө', note: 'On foot. Kazakh жаяу. Kyrgyz also has no қ or ұ, which Kazakh uses constantly.' },
    { text: 'билбейм', note: 'I do not know, negated with -бе- inside the verb. Kazakh writes білмеймін, Russian needs a separate не.' },
  ],
  slk: [
    { text: 'ľ', note: 'A soft l. Czech has no such letter, and this is the quickest way to tell the two apart.' },
    { text: 'horúci', note: 'Hot. Czech horký: Slovak keeps the -úci ending Czech dropped.' },
    { text: 'pešo', note: 'On foot. Czech pěšky, Polish pieszo, Slovene peš.' },
    { text: 'Neviem', note: 'I do not know. Czech nevím.' },
  ],
  slv: [
    { text: 'zjutraj', note: 'This morning. Croatian jutros, from the same root, built differently.' },
    { text: 'službo', note: 'Work. Croatian posao, Czech práce.' },
    { text: 'pelje', note: 'Leads. Slovene kept the dual number, a whole grammatical form the others lost.' },
    { text: 'mrzlo', note: 'Cold. Croatian hladno, Slovak zima: three Slavic languages, three unrelated words.' },
  ],
  lav: [
    { text: 'ļ', note: 'A soft l with a comma under it. Lithuanian has no such letter.' },
    { text: 'ņ', note: 'A soft n, the same comma. Latvian and Lithuanian are the only two Baltic languages left and they are not mutually intelligible.' },
  ],
  glg: [
    { text: 'traballo', note: 'Work. Spanish trabajo, Portuguese trabalho: Galician sits between them and spells it a third way.' },
    { text: 'mañá', note: 'Morning. Spanish mañana, Portuguese manhã.' },
    { text: 'camiño', note: 'Road. Galician keeps the enye Portuguese turned into nh.' },
    { text: 'moito', note: 'Much. Spanish mucho, Portuguese muito.' },
  ],
  gle: [
    { text: 'Bhí', note: 'Was, with lenition written as bh. Irish marks long vowels with an acute; Scottish Gaelic uses a grave.' },
    { text: 'dtéann', note: 'Eclipsis: Irish writes the new sound in front of the old letter, so the d is said and the t is silent. Scottish Gaelic does not eclipse.' },
    { text: 'Siúlann', note: 'Walks. Irish puts the verb first, and this ending is one Scottish Gaelic does not have.' },
    { text: 'hoibre', note: 'An h wedged in after the article. Irish mutates the fronts of words. Welsh does too, but Welsh shows ll and dd.' },
  ],
  gla: [
    { text: 'glè', note: 'Very, with a grave accent. Irish writes every long vowel with an acute instead.' },
    { text: 'Càite', note: 'Where. Irish writes cá, and the grave accent here is the giveaway.' },
    { text: 'coiseachd', note: 'Walking. Irish siúl: the two languages split in the middle ages and kept different words for it.' },
    { text: 'theth', note: 'Hot, lenited. Irish te.' },
  ],
  mlt: [
    { text: 'għ', note: 'A silent digraph that lengthens the vowel beside it. Maltese only, and it is Arabic ain written in Latin letters.' },
    { text: 'ħ', note: 'A barred h. Maltese is the one Semitic language whose standard spelling is Latin.' },
    { text: 'Kuljum', note: 'Every day, from Arabic kull yawm. The grammar is Arabic and half the vocabulary is Italian.' },
    { text: 'nafx', note: 'I do not know. The x is pronounced sh, as in Portuguese.' },
  ],
  fao: [
    { text: 'gongur', note: 'Walks. Icelandic gengur: the two split about a thousand years ago and still look it.' },
    { text: 'ikki', note: 'Not. Icelandic ekki, Danish ikke.' },
    { text: 'hvønn', note: 'Each. Faroese uses ø where Icelandic uses ö.' },
    { text: 'hesin', note: 'This. Icelandic þessi, and Faroese has no thorn at all.' },
    { text: 'sera', note: 'Very. Icelandic mjög, Danish meget.' },
    { text: 'mær', note: 'To me. Faroese keeps four cases, as Icelandic does and the mainland does not.' },
  ],
  ltz: [
    { text: 'Ech', note: 'I. German ich, and Luxembourgish spells the sound it actually makes.' },
    { text: 'dofir', note: 'Therefore. German dafür.' },
    { text: 'Fouss', note: 'Foot. German Fuß, and Luxembourgish has no sharp s at all.' },
    { text: 'wouhin', note: 'Where to. German wohin, with an extra u.' },
  ],
  bre: [
    { text: 'c’h', note: 'A trigraph with an apostrophe inside it, for a sound Welsh writes ch. Breton only.' },
    { text: 'Bemdez', note: 'Every day, in one word. Welsh needs three: bob dydd.' },
    { text: 'war-droad', note: 'On foot. Welsh would say ar droed, which is the same words and not the same spelling.' },
    { text: 'mintin', note: 'Morning. Welsh bore: Breton and Welsh are close cousins that stopped being mutually intelligible.' },
  ],
  fry: [
    { text: 'Fanmoarn', note: 'This morning. Dutch vanochtend, and Frisian is closer to English than to Dutch in its oldest words.' },
    { text: 'dêrom', note: 'Therefore. Dutch daarom, with a circumflex Dutch never uses.' },
    { text: 'wurk', note: 'Work. Dutch werk, English work.' },
    { text: 'dyk', note: 'Road, and also dyke. Dutch dijk, English dyke: Frisian is the closest living language to English.' },
    { text: 'wêr', note: 'Where. Dutch waar, with a circumflex Dutch does not use.' },
    { text: 'in bakje', note: 'A cup, literally a little tray. Dutch writes een bakje: Frisian cut the article down to in, and that one word separates them.' },
  ],
  // Added 2026-09-15. Nine of these are the only language in the game
  // written in their alphabet, so the reveal says that by itself; the
  // markers are what to look at once you know which alphabet it is.
  div: [
    { text: 'ް', note: 'The sukun, a circle marking no vowel. Thaana hangs its vowels off the consonants as Arabic does, and is written right to left for the same reason.' },
    { text: 'ށް', note: 'Thaana was built out of Arabic numerals: the first nine letters are the digits one to nine turned on their side.' },
    { text: 'ނޭނގެ', note: 'I do not know. Dhivehi is Indo-Aryan, closest to Sinhala, and shares no letters with it.' },
  ],
  bod: [
    { text: 'དེ་རིང', note: 'Today. Dzongkha says ད་རིས, and the two are as close as Danish and Swedish.' },
    { text: 'འགྲོ', note: 'To go. Dzongkha writes འགྱོཝ.' },
    { text: 'བཏུངས', note: 'Drank. Tibetan spelling keeps consonants that stopped being said a thousand years ago; Dzongkha, in the same letters, spells much closer to speech.' },
  ],
  dzo: [
    { text: 'ད་རིས', note: 'Today. Tibetan says དེ་རིང.' },
    { text: 'འགྱོཝ', note: 'Going. Tibetan writes འགྲོ.' },
    { text: 'ཨིན', note: 'Is. Dzongkha and Tibetan share an alphabet and split about five hundred years ago.' },
  ],
  sat: [
    { text: 'ᱟᱹ', note: 'The ahad, a mark for a vowel Santali has and its neighbours do not.' },
    { text: 'ᱧ', note: 'Ol Chiki was designed in 1925 by a Santal schoolteacher, so that Santali would stop being written in three other alphabets.' },
    { text: 'ᱩᱱᱤ', note: 'He or she. Santali is Austroasiatic, related to Khmer and Vietnamese rather than to anything around it.' },
  ],
  mni: [
    { text: 'ꯑꯩ', note: 'I. Meetei Mayek was revived in the twentieth century after two centuries of Manipuri being written in Bengali letters.' },
    { text: 'ꯆꯠ', note: 'To go. Manipuri is Sino-Tibetan, written in a revived alphabet rather than the Bengali letters it used for two centuries.' },
    { text: 'ꯅꯨꯃꯤꯠ', note: 'Day. Meetei Mayek is written for Manipuri and nothing else, so recognising the letters is the whole answer.' },
  ],
  chr: [
    { text: 'ᎥᏝ', note: 'Not. Sequoyah built this syllabary around 1820 without being able to read any other writing, which had never been done before or since.' },
    { text: 'ᎠᎩᏗᏔᏅᎩ', note: 'I drank it. One Cherokee word carries what English needs three for.' },
    { text: 'ᏂᏚᎩᏨᏂᏓᏒ', note: 'Every day. Some characters look like Latin letters and none of them sound like one: Ꮎ is na, Ꭶ is ga.' },
  ],
  iku: [
    { text: 'ᖅ', note: 'A final ᖅ. Word after word ends in it. Cree uses the same syllabary and does not, which is how the two are told apart at a glance.' },
    { text: 'ᐅᓪᓗᑕᒫᑦ', note: 'Every day. The syllabary was adapted from Cree, so the letters look alike; these long ᑦ and ᖅ endings are Inuktitut.' },
    { text: 'ᖃᐅᔨᒪᖏᑦᑐᖓ', note: 'I do not know, in one word: Inuktitut builds a sentence by stacking endings onto a single root.' },
  ],
  nqo: [
    { text: '߬', note: 'A tone mark. N’Ko writes every tone, which the Latin spellings of the same language do not.' },
    { text: 'ߒ', note: 'I. N’Ko was designed in 1949 by Solomana Kanté so that Manding would have an alphabet of its own, and it runs right to left.' },
    { text: 'ߛߌߟߊ', note: 'Road. The same language is also written in Latin and in Arabic letters, and only N’Ko marks its tones.' },
  ],
  fuf: [
    { text: '𞤴𞤢𞤸𞤮', note: 'Day. Adlam was invented in the 1980s by two teenage brothers in Guinea, and is named after its first four letters.' },
    { text: '𞤥𞤭', note: 'I. Adlam runs right to left and joins up, like the Arabic it replaced for this language.' },
    { text: '𞤢', note: 'The commonest vowel. Adlam was invented for Pular in the 1980s and is written for nothing else, so the alphabet settles it.' },
  ],
  zgh: [
    { text: 'ⴰⵙⵙ', note: 'Day. Tifinagh is written for Berber and nothing else, so these shapes are most of the answer; it was made official in Morocco in 2011.' },
    { text: 'ⵓⵔ', note: 'Not. Tamazight is also written in Latin and Arabic letters, and Tifinagh is the one that is nobody else’s.' },
    { text: 'ⵜ', note: 'T. Tamazight wraps feminine nouns in ⵜ at both ends, so the letter bookends words all through a sentence.' },
  ],
  gom: [
    { text: 'हांवें', note: 'I, marking a past transitive subject. Marathi says मी, Hindi मैंने.' },
    { text: 'खंय', note: 'Where. Marathi कुठे, Hindi कहाँ.' },
    { text: 'वता', note: 'Goes. Marathi जातो: the two share a coast and a script and not this verb.' },
    { text: 'दिसा', note: 'Day. Marathi दिवस, Hindi दिन.' },
  ],
  doi: [
    { text: 'जंदा', note: 'Goes. Hindi जाता, Punjabi ਜਾਂਦਾ: Dogri sits between the two and takes the Punjabi form in Devanagari letters.' },
    { text: 'मिगी', note: 'To me. Hindi मुझे, Nepali मलाई.' },
    { text: 'सबेरे', note: 'In the morning. Hindi सुबह.' },
    { text: 'ओह्', note: 'He, with a halant that stops the vowel. Hindi writes वह.' },
  ],
  awa: [
    { text: 'भिनसार', note: 'Dawn. Hindi सुबह, Bhojpuri भोरे.' },
    { text: 'पियेन', note: 'Drank, first person. Bhojpuri पिअनी, Hindi पी.' },
    { text: 'हमका', note: 'To me. Hindi मुझे, Bhojpuri हमरा.' },
    { text: 'जात ह', note: 'Goes, with the copula written separately as ह. Hindi जाता है.' },
  ],
  new: [
    { text: 'जिं', note: 'I, marking a past transitive subject. Nepali uses मैले, and Newar is not an Indo-Aryan language at all.' },
    { text: 'थौं', note: 'Today. Nepali आज, Hindi आज: Newar shares the alphabet and not the word.' },
    { text: 'झाइ', note: 'Goes. Nepali जान्छ, and the verbs are where a Sino-Tibetan language in Devanagari gives itself away.' },
    { text: 'मसिउ', note: 'I do not know. Newar is Sino-Tibetan, spoken in a valley surrounded by Indo-Aryan, and written in the same alphabet as its neighbours.' },
  ],
  pnb: [
    { text: 'سویرے', note: 'In the morning. Urdu writes صبح.' },
    { text: 'بہوں', note: 'Very. Urdu بہت. The alphabet is Urdu\u2019s, so the words are the only tell.' },
    { text: 'جاندا', note: 'Goes. Urdu جاتا, and this is the same split as Punjabi against Hindi on the other side of the border.' },
    { text: 'مینوں', note: 'To me. Urdu writes مجھے, and Eastern Punjabi writes the same word as ਮੈਨੂੰ in Gurmukhi.' },
  ],
  prs: [
    { text: 'سرک', note: 'Road, in Afghanistan. Iranian Persian says جاده or خیابان.' },
    { text: 'بسیار', note: 'Very. Iranian Persian would more often write خیلی.' },
    { text: 'میرود', note: 'Goes. Iranian Persian puts a zero width non joiner inside the same word, می\u200Cرود; Dari writes it solid.' },
  ],
  bal: [
    { text: 'ۏ', note: 'A vowel written with a small v, for Balochi only.' },
    { text: 'کنت', note: 'Does. Balochi puts an auxiliary on the end where Persian does not.' },
    { text: 'وارتُن', note: 'I ate or drank. Balochi and Persian are both Iranian and split long before either was written.' },
  ],
  kas: [
    { text: 'ٲ', note: 'A vowel written with a wavy line over the alif. Kashmiri needs more vowel marks than any other language in this script and writes them all.' },
    { text: 'ۄ', note: 'Another Kashmiri vowel, a small v under the letter. Urdu shares this alphabet and has no sign like it.' },
    { text: 'گژھ', note: 'To go. Kashmiri is Dardic rather than Indo-Aryan, so the verb looks nothing like Urdu\'s or Punjabi\'s.' },
  ],
  arz: [
    { text: 'عشان', note: 'Because. Standard Arabic would write لذلك or لأن.' },
    { text: 'النهارده', note: 'Today, one word. Standard Arabic اليوم.' },
    { text: 'بيروح', note: 'Goes, with a bi- prefix on the present. Standard Arabic has no such prefix.' },
    { text: 'بيودي', note: 'Leads to. Moroccan would say كيوصل, standard Arabic يؤدي.' },
  ],
  ary: [
    { text: 'بزاف', note: 'A lot, from Berber. Egyptian says قوي, standard Arabic جدا.' },
    { text: 'كيمشي', note: 'Goes, with a ka- prefix. Egyptian uses bi-, standard Arabic neither.' },
    { text: 'علاحقاش', note: 'Because. Egyptian عشان.' },
    { text: 'هاد', note: 'This. Standard Arabic هذا, and Moroccan drops most short vowels, which is why the words look shorter.' },
  ],
  tat: [
    { text: 'җ', note: 'A Tatar letter for j. Bashkir, its nearest relative, does not have it.' },
    { text: 'Бүген', note: 'Today. Bashkir writes Бөгөн.' },
    { text: 'чәй', note: 'Tea. Bashkir сәй: Bashkir turned Tatar\u2019s ch into s across the board.' },
    { text: 'белмим', note: 'I do not know. Bashkir writes белмәйем, which is the same word with more of it left in.' },
  ],
  bak: [
    { text: 'ҙ', note: 'A Bashkir letter for a th sound. Tatar has no such letter and no such sound.' },
    { text: 'ҡ', note: 'A deep k with a tail. Kazakh writes қ for the same sound, with a different tail.' },
    { text: 'һыуыҡ', note: 'Cold. Tatar салкын: the two are close enough to be mutually intelligible and spell almost nothing the same.' },
    { text: 'Бөгөн', note: 'Today. Tatar Бүген, with ү where Bashkir rounds it to ө.' },
    { text: 'йәйәү', note: 'On foot. Tatar җәяү: Bashkir has no җ, so it writes й instead.' },
  ],
  chv: [
    { text: 'ӑ', note: 'A short a with a breve. Chuvash is the only survivor of a whole branch of Turkic and looks it.' },
    { text: 'ҫ', note: 'A c with a cedilla, Chuvash only.' },
    { text: 'эпӗ', note: 'I. Tatar мин, Bashkir мин: Chuvash shares almost no basic vocabulary with the Turkic around it.' },
  ],
  sah: [
    { text: 'сарсыарда', note: 'In the morning. Kyrgyz эртең менен, Kazakh таңертең.' },
    { text: 'испитим', note: 'I drank. Sakha keeps long vowels and diphthongs the other Turkic languages lost.' },
    { text: 'сатыы', note: 'On foot. Kazakh жаяу, Kyrgyz жөө.' },
    { text: 'билбэппин', note: 'I do not know. Sakha is Turkic, spoken further north than any other Turkic language.' },
  ],
  oss: [
    { text: 'æ', note: 'The Latin letter, inside a Cyrillic alphabet. Ossetian is the only language that does this, and it is its commonest vowel.' },
    { text: 'фæндаг', note: 'Road. Ossetian is an Iranian language written in Cyrillic; Russian would write дорога, and has no letter æ.' },
    { text: 'куыстмæ', note: 'To work, with the case on the end. Ossetian is an Iranian language in Cyrillic and declines in nine cases; Russian would need a preposition, на работу.' },
  ],
  che: [
    { text: 'Ӏ', note: 'The palochka, a stick borrowed from the Latin capital I to mark a sound made in the throat. Several Caucasian languages use it and none of the Slavic ones do.' },
    { text: 'воьду', note: 'Goes. The v agrees with the subject\'s gender, and Chechen has six. Russian has three and marks them on the noun, not the verb.' },
    { text: 'хаьа', note: 'Knows. Chechen spells vowels with a following soft sign, so ь lands mid-word where Russian only ever puts it after a consonant.' },
  ],
  bos: [
    { text: 'veoma', note: 'Very. Croatian vrlo, Slovene zelo.' },
    { text: 'skuhao', note: 'Cooked or brewed. Bosnian keeps the h that Croatian and Serbian often drop.' },
    { text: 'svakodnevno', note: 'Daily, in one word. Croatian would say svaki dan.' },
    { text: 'ovaj', note: 'This. Slovene ta, Slovak tento.' },
    { text: 'pješke', note: 'On foot. Croatian pješice, Slovene peš, Slovak pešo.' },
  ],
  oci: [
    { text: 'fasiá', note: 'Was doing. French faisait, Catalan feia: Occitan sits between them and is neither.' },
    { text: 'begut', note: 'Drunk. Catalan begut too, French bu, and the pair is why Occitan is often taken for Catalan.' },
    { text: 'jorn', note: 'Day. French jour, Catalan dia.' },
    { text: 'Sabi pas', note: 'I do not know. Occitan negates by putting pas after the verb, as spoken French does and written French does not.' },
  ],
  srd: [
    { text: 'manzanu', note: 'Morning. Italian mattina, Spanish mañana.' },
    { text: 'duncas', note: 'So. Sardinian kept Latin sounds every other Romance language changed, which is why it looks older than it is.' },
    { text: 'dontzi', note: 'Every. Italian ogni, and Sardinian keeps the Latin dz sound Italian lost.' },
    { text: 'caminu', note: 'Road, with the Latin ending intact. Spanish camino, Galician camiño.' },
  ],
  ast: [
    { text: 'muncho', note: 'Much. Spanish mucho, with an n Asturian keeps.' },
    { text: 'trabayu', note: 'Work. Spanish trabajo, Galician traballo: three neighbours, three spellings of the same Latin word.' },
    { text: 'tolos', note: 'All the, contracted. Spanish todos los.' },
    { text: 'fríu', note: 'Cold. Spanish frío, Galician frío: Asturian moves the accent onto the u.' },
    { text: 'camín', note: 'Road. Spanish camino, Galician camiño, and Asturian drops the last vowel.' },
    { text: 'Nun', note: 'Not. Spanish no, Galician non: three neighbours, three words for it.' },
  ],
  roh: [
    { text: 'damaun', note: 'Morning. Italian mattina, French matin, and Romansh is a fourth answer for the same Latin word.' },
    { text: 'perquai', note: 'Therefore. Italian perciò, French donc.' },
    { text: 'mintga', note: 'Every. Italian ogni, German jeder, and Romansh borrowed from neither.' },
    { text: 'betg', note: 'Not. Romansh piles up consonants in a way no other Romance language does.' },
  ],
  fur: [
    { text: 'buinore', note: 'Morning. Italian mattina, and Friulian is a different branch of Romance rather than an Italian dialect.' },
    { text: 'bevût', note: 'Drunk, with a circumflex marking a long vowel. Italian has no long vowels to mark.' },
    { text: 'lavôr', note: 'Work. Italian lavoro, with the circumflex marking a length Italian does not have.' },
    { text: 'pît', note: 'Foot. Italian piede, and Friulian cuts the ending off and lengthens the vowel.' },
    { text: 'dulà', note: 'Where. Italian dove, Venetian dove: Friulian is not a dialect of either.' },
    { text: 'cjalt', note: 'Hot. Italian caldo: Friulian turns that c into cj.' },
  ],
  sme: [
    { text: 'iđđes', note: 'In the morning. The crossed d is a Sami letter, and the language is Uralic, related to Finnish rather than to Norwegian.' },
    { text: 'vázzá', note: 'Walks. Sami marks long vowels with an acute and consonant length by doubling.' },
    { text: 'geaidnu', note: 'Road. Finnish tie: the two are related and split thousands of years ago.' },
    { text: 'dieđe', note: 'Know. Finnish tietää, and the pair shows the two are related at a distance.' },
  ],
  hsb: [
    { text: 'Dźensa', note: 'Today. Czech dnes, Polish dziś: Sorbian is a Slavic language spoken inside Germany.' },
    { text: 'pěši', note: 'On foot. Czech pěšky, Polish pieszo: Sorbian sits between the two and matches neither.' },
    { text: 'Njewěm', note: 'I do not know. Czech nevím, Polish nie wiem.' },
    { text: 'dźěła', note: 'Work. Sorbian uses ł like Polish and ě like Czech, and is spoken between the two.' },
  ],
  ibo: [
    { text: 'ụ', note: 'A u with a dot under it, a different vowel from plain u. Yoruba writes dots below as well, but stacks tone accents on top; Igbo leaves the top clear.' },
    { text: 'na-aga', note: 'Is going. Igbo hyphenates the tense onto the verb; Yoruba writes its ń as a separate word.' },
    { text: 'Amaghị', note: 'Do not know. Yoruba marks tone with accents; Igbo mostly leaves tone unwritten and marks vowels instead.' },
    { text: 'ọkụ', note: 'Hot, with dots under both vowels. Yoruba puts its dots under o, e and s instead.' },
  ],
  aka: [
    { text: 'Anɔpa', note: 'Morning. Akan writes open o and e as ɔ and ɛ; Yoruba writes the same two vowels with dots underneath instead.' },
    { text: 'awɔw', note: 'Cold. Akan is tonal and does not write the tones, unlike Yoruba next door.' },
    { text: 'adwuma', note: 'Work. The dw is one sound. Ewe and Ga, its neighbours on the same coast, write dɔ and nitsumɔ.' },
    { text: 'Minnim', note: 'I do not know, negated by doubling the n. Ewe wraps mé and o round the verb, Yoruba puts kò in front.' },
  ],
  wol: [
    { text: 'lool', note: 'Very. Wolof doubles vowels for length, so pairs turn up all through a sentence; French, which shares Senegal\'s page with it, never doubles.' },
    { text: 'Xamuma', note: 'I do not know. Wolof writes x for a sound made in the throat, as Somali does.' },
    { text: 'attaaya', note: 'Tea, from Arabic, and the whole ceremony with it.' },
    { text: 'Dafay', note: 'Wolof puts the emphasis in the conjugation: dafa says the point of the sentence is the verb itself. French does that with word order instead.' },
    { text: 'liggéey', note: 'Work. Wolof doubles vowels for length and treats é as its own letter; Pulaar, the other written language of Senegal, has neither.' },
    { text: 'bu nekk', note: 'Every. Bés is a b-class noun, so each agrees with it as bu; Wolof marks noun class with a consonant on the end, where Bantu languages like Swahili put a prefix on the front.' },
  ],
  kin: [
    { text: 'icyayi', note: 'Tea. Kinyarwanda glues a class prefix on every noun, here i- plus cy-. Swahili writes chai, Luganda caayi.' },
    { text: 'amaguru', note: 'Legs, in the ama- plural class. Luganda has ama- too but would write amagulu with an l; Swahili uses ma-.' },
    { text: 'Sinzi', note: 'I do not know. Luganda writes Simanyi, Swahili Sijui: the si- is shared across Bantu, the -nzi is Kinyarwanda.' },
  ],
  nya: [
    { text: 'kwambiri', note: 'Very much. Shona zvikuru, and the two are neighbours that share little vocabulary.' },
    { text: 'ndinamwa', note: 'I drank: subject, tense and verb in one word, as in Swahili and with different pieces.' },
    { text: 'kuntchito', note: 'To work. Chichewa writes tch where Shona writes ch.' },
    { text: 'msewu', note: 'Road. Shona mugwagwa, Swahili barabara.' },
    { text: 'Sindikudziwa', note: 'I do not know, negated with si- on the front. Shona uses ha-, Zulu angi-.' },
  ],
  sna: [
    { text: 'Mangwanani', note: 'Morning. Chichewa m’mawa, Zulu ekuseni.' },
    { text: 'ndakanwa', note: 'I drank. Shona writes whole sentences as single words more than most Bantu languages.' },
    { text: 'netsoka', note: 'With the feet. Shona writes sv, zv and tsv for its whistled sounds, which Swahili does not have.' },
    { text: 'mugwagwa', note: 'Road. Chichewa msewu, Swahili barabara.' },
    { text: 'Handizivi', note: 'I do not know, negated with ha- on the front. Chichewa uses si-, Zulu angi-.' },
  ],
  xho: [
    { text: 'ndisele', note: 'I drank. Zulu would write ngiphuze: the two are close enough to understand each other and use different verbs here.' },
    { text: 'Andazi', note: 'I do not know. Zulu angazi.' },
    { text: 'ngeenyawo', note: 'By foot. Zulu ngezinyawo, and the doubled vowel is a Xhosa spelling Zulu does not use.' },
    { text: 'ndlela', note: 'Road. Clicks are written c, q and x. Zulu writes them the same way, so a click points to southern Africa.' },
  ],
  sot: [
    { text: 'Hoseng', note: 'In the morning. Tswana mosong.' },
    { text: 'kahoo', note: 'Therefore. Sesotho and Tswana are close enough to be counted one language by some and not by others.' },
    { text: 'chesang', note: 'Hot. Tswana mogote, and the class agreement on the end differs too.' },
    { text: 'Ha ke tsebe', note: 'I do not know. Tswana says Ga ke itse, which is the same three words and not one spelling shared.' },
    { text: 'mosebetsing', note: 'At work, with the place marked by -ng on the end. Tswana tirong.' },
  ],
  tsn: [
    { text: 'mosong', note: 'In the morning. Sesotho hoseng.' },
    { text: 'tsidifetse', note: 'Has got cold. Sesotho would build the same idea as ho bata.' },
    { text: 'dinao', note: 'Feet. Sesotho maoto: the class prefixes differ even where the word does not.' },
    { text: 'Ga ke itse', note: 'I do not know. Sesotho says Ha ke tsebe.' },
    { text: 'tirong', note: 'At work. Sesotho mosebetsing.' },
  ],
  lug: [
    { text: 'kunnyogoga', note: 'To be cold. Luganda doubles consonants for length and the meaning turns on it; Swahili and Kinyarwanda never double.' },
    { text: 'nnanywa', note: 'I drank. The nn- carries the person and the length at once. Swahili writes nilikunywa, Kinyarwanda nanyoye.' },
    { text: 'ebigere', note: 'Feet, in the bi- class, with the rest of the sentence agreeing. Swahili marks that same class vi-, which is why its plurals look nothing like these.' },
    { text: 'oluguudo', note: 'Road, in the lu- class with the vowel doubled for length. Kinyarwanda and Swahili do not double vowels; Luganda does it constantly.' },
    { text: 'Simanyi', note: 'I do not know. Swahili sijui: the si- is the same negative in both.' },
  ],
  lin: [
    { text: 'ntɔngɔ', note: 'Morning. Lingala uses open o and open e, as the West African languages do, and is Bantu like Swahili.' },
    { text: 'namɛlaki', note: 'I drank. Swahili nilikunywa, and the pieces are in the same order in a different language.' },
    { text: 'Atambolaka', note: 'Walks, over and over: -aka marks a habit. Swahili puts hu- in front for the same idea, Lingala hangs it on the end.' },
    { text: 'nzela', note: 'Road. Swahili njia, and Lingala fronts more of its consonants with n.' },
    { text: 'Nayebi', note: 'I know. Lingala negates by adding te at the end, where Swahili uses a prefix.' },
  ],
  bam: [
    { text: 'sɔgɔma', note: 'Morning. This is the same language N’Ko was invented for, written in Latin letters instead.' },
    { text: 'kosɛbɛ', note: 'Very much. Bambara is Mande, not Bantu: no noun classes, so words take none of the prefixes Swahili and Zulu hang on the front.' },
    { text: 'sira', note: 'Road. The same word N’Ko writes as ߛߌߟߊ, in Latin letters.' },
    { text: 'baara', note: 'Work. Bambara is Mande, not Bantu, and has no noun classes at all.' },
  ],
  gaz: [
    { text: 'ganama', note: 'Morning. Oromo is Cushitic and was written in Ethiopic until 1991, when it moved to Latin letters.' },
    { text: 'qorree', note: 'Cold. Oromo doubles vowels and consonants both; Somali, its neighbour, doubles vowels only.' },
    { text: 'miilaan', note: 'On foot. The doubled i is length and the word changes without it. Somali says lug for the same thing.' },
    { text: 'Karaan', note: 'Road. Amharic, its neighbour, writes the same country in a different alphabet.' },
  ],
  plt: [
    { text: 'Nangatsiaka', note: 'Was cold. Malagasy is Austronesian, with its closest relatives in Borneo; nothing else written in Africa reads like it.' },
    { text: 'nisotro', note: 'Drank. Malagasy swaps the first letter for tense: misotro now, nisotro then, hisotro later. Swahili and Zulu leave a verb\'s first letter alone.' },
    { text: 'an-tongotra', note: 'On foot. Malagasy hyphenates prepositions onto the noun; Indonesian, a relative far to the north, writes dengan kaki as two words.' },
    { text: 'lalana', note: 'Road. Malay jalan, and the pair is the clearest sign of where this language came from.' },
  ],
  jav: [
    { text: 'Esuk iki', note: 'This morning. Indonesian pagi ini, Sundanese isuk ieu.' },
    { text: 'ngombe', note: 'Drinks. Indonesian minum, and Javanese shares an island with it and few verbs.' },
    { text: 'menyang', note: 'To, towards. Indonesian ke.' },
    { text: 'ora ngerti', note: 'Do not know. Indonesian tidak tahu, Sundanese teu nyaho.' },
  ],
  sun: [
    { text: 'Isuk ieu', note: 'This morning. Javanese esuk iki, one island and two languages apart.' },
    { text: 'kuring', note: 'I. Javanese aku, Indonesian saya.' },
    { text: 'leumpang', note: 'Walks. Javanese mlaku, Indonesian berjalan: three languages on one island, three words.' },
    { text: 'nyaho', note: 'Know. Javanese ngerti, Indonesian tahu.' },
  ],
  ceb: [
    { text: 'kaayo', note: 'Very. Tagalog napaka-, stuck on the front of the word instead.' },
    { text: 'Maglakaw', note: 'Will walk. Tagalog naglalakad, and the repeated syllable is the Tagalog way, not the Cebuano one.' },
    { text: 'kahibalo', note: 'Know. Tagalog alam, and the two are the biggest languages of the same country.' },
    { text: 'ganina', note: 'Earlier today. Cebuano has a word for it that Tagalog builds out of two.' },
  ],
  ilo: [
    { text: 'Nalam-ek', note: 'Cold. Ilocano hyphenates a glottal stop in the middle of a word, which Tagalog and Cebuano do not.' },
    { text: 'inaldaw', note: 'Every day. Tagalog araw-araw, Cebuano matag adlaw.' },
    { text: 'daytoy', note: 'This. Tagalog ito, Cebuano kini.' },
  ],
  kmr: [
    { text: 'nizanim', note: 'I do not know. This is the same language as Sorani, written in Latin letters instead of Arabic ones.' },
    { text: 'peyatî', note: 'On foot. Sorani would write the same word in Arabic letters as بە پێ.' },
    { text: 'sibehê', note: 'Morning, with a case ending on it. Kurmanji still marks case and Sorani has stopped.' },
    { text: 'diçe', note: 'Goes. Turkish gidiyor, and Kurmanji is not Turkic at all.' },
  ],
  tuk: [
    { text: 'pyýada', note: 'On foot. Azerbaijani piyada, Turkish yürüyerek.' },
    { text: 'bilemok', note: 'I do not know, negated with -ok on the end. Turkish writes bilmiyorum, Azerbaijani bilmirəm: same verb, and only Turkmen ends it this way.' },
    { text: 'sowukdy', note: 'Was cold. Turkish soğuktu, and Turkmen writes the same word without the soft g.' },
  ],
  tet: [
    { text: 'ha’u', note: 'I. Tetum counts the glottal stop a letter and writes it as an apostrophe; Indonesian, spoken all around it, writes k at the end of a word instead.' },
    { text: 'loron-loron', note: 'Every day, said by repeating the word for day, as Tagalog does.' },
    { text: 'hatene', note: 'Know. Tetum has Portuguese loans all through it and a Malayo-Polynesian frame.' },
    { text: 'ne’ebé', note: 'Where. Tetum borrows heavily from Portuguese and keeps its own question words.' },
  ],
  mri: [
    { text: 'huarahi', note: 'Road. Hawaiian alanui, Samoan auala: the same family, a long way apart.' },
    { text: 'makariri', note: 'Cold. Samoan malulu, Hawaiian anu, and all three are the same family.' },
    { text: 'nō reira', note: 'Therefore. Maori marks its long vowels with macrons, as Hawaiian and Tongan do.' },
    { text: 'hīkoi', note: 'Walk. Maori marks long vowels with a macron and has no s, b, d, g or v at all.' },
    { text: 'Kāore', note: 'Not. Hawaiian ʻaʻole, Samoan le, Tongan ʻikai.' },
    { text: 'tēnei', note: 'This. Hawaiian kēia, and the t against k is the split that runs through Polynesian.' },
  ],
  smo: [
    { text: 'auala', note: 'Road. Maori huarahi, Hawaiian alanui.' },
    { text: 'savali', note: 'Walks. Samoan has v where Hawaiian has w and Maori has wh.' },
    { text: 'taeao', note: 'Morning. Five vowels in a row is normal here and impossible in most languages.' },
    { text: 'iloa', note: 'Know. Maori mōhio, Hawaiian ʻike.' },
  ],
  ton: [
    { text: 'pongipongi', note: 'Morning. Samoan taeao, Maori ata.' },
    { text: 'ʻikai', note: 'Not. Hawaiian ʻaʻole, Samoan le.' },
    { text: 'hala', note: 'Road. Samoan auala, Maori huarahi.' },
    { text: 'ngāue', note: 'Work. Tongan writes a definite accent as well as a macron; Samoan and Hawaiian use the macron alone.' },
  ],
  fij: [
    { text: 'batabata', note: 'Cold, said twice to soften it. Samoan and Maori double words too, but Fijian\'s b stands for mb, which is why the result looks unpronounceable.' },
    { text: 'gaunisala', note: 'Road. Fijian writes b, d, q and g for sounds spelled mb, nd, ngg and ng elsewhere, which is why the words look unpronounceable and are not.' },
    { text: 'taubale', note: 'Walks. Fijian is Oceanic but not Polynesian: Samoan and Maori would show far fewer consonants in the same sentence.' },
    { text: 'nikua', note: 'Today. Samoan aso nei, Tongan ʻaho ni.' },
  ],
  haw: [
    { text: 'kakahiaka', note: 'Morning. Hawaiian has eight consonants, among the fewest of any language, so words are long and mostly vowels.' },
    { text: 'alanui', note: 'Road. Maori huarahi, Samoan auala.' },
    { text: 'wāwae', note: 'Feet. Hawaiian has w where Samoan has v and Tongan has v.' },
    { text: 'kēia', note: 'This. Maori tēnei, and Hawaiian turned every Polynesian t into a k.' },
  ],
  tpi: [
    { text: 'wokabaut', note: 'Walks, from English walk about. Tok Pisin spells English words as Melanesians say them.' },
    { text: 'tumas', note: 'Very, from the English too much. Almost every word here is English wearing a different spelling.' },
    { text: 'Mi no save', note: 'I do not know. Save is from Portuguese saber, which reached the Pacific before English did.' },
    { text: 'olgeta', note: 'All, from altogether. Tok Pisin builds a full grammar out of a few hundred English words.' },
  ],
  que: [
    { text: 'paqarin', note: 'Morning. Aymara alwa, and the two share the altiplano and almost no basic vocabulary.' },
    { text: 'chakillawan', note: 'On foot, with the case stacked on the end. Aymara kayuki.' },
    { text: 'punchaw', note: 'Day. Aymara uru, and the two languages have shared the same valleys for a thousand years.' },
    { text: 'yachanichu', note: 'I do not know. Quechua hangs -chu on the verb and still needs manam in front; Aymara, its neighbour, negates with jani.' },
  ],
  aym: [
    { text: 'Jichhüru', note: 'Today. Quechua kunan, and the two share the altiplano, many words and no ancestor anyone can prove.' },
    { text: 'thakhix', note: 'The road. Quechua ñan, and the x on the end is a suffix rather than part of the word.' },
    { text: 'kayuki', note: 'On foot. Quechua chakillawan.' },
    { text: 'Janiw', note: 'Not. Quechua mana, and the two languages are neighbours nobody has proved are related.' },
  ],
  grn: [
    { text: 'ĩ', note: 'A nasal vowel with a tilde. Guarani nasalises whole words and marks it on the vowel; Portuguese marks only a and o that way.' },
    { text: 'mbaʼapo', note: 'Work. Guarani writes mb, nd and ng at the start of words, which Spanish beside it never does.' },
    { text: 'pyhareve', note: 'Morning. Guarani is co-official with Spanish and spoken by more people in the country than Spanish is.' },
    { text: 'Ndaikuaái', note: 'I do not know, with the negative bracketing the verb as nd- and -i. Spanish, spoken beside it, puts a single no in front.' },
  ],
  hat: [
    { text: 'konnen', note: 'Know. French connaître, spelled the way it is said.' },
    { text: 'Mwen', note: 'I. French moi, and Haitian writes ou, w and y where French writes oi, ou and ill.' },
    { text: 'frèt', note: 'Cold. French froid, and Haitian spells the grave accent it actually says.' },
    { text: 'bwè', note: 'Drank. French boire, written the way a Haitian says it.' },
    { text: 'wout', note: 'Road. French route, and Haitian writes ou and w where French writes ou and oi.' },
    { text: 'chak jou', note: 'Every day. French chaque jour.' },
  ],
  pap: [
    { text: 'kaminda', note: 'Road. Spanish camino, Portuguese caminho, and Papiamento sits on top of both.' },
    { text: 'tabata masha', note: 'Was very. Papiamento marks tense with a separate word in front of the verb, which neither Spanish nor Dutch does.' },
    { text: 'trabou', note: 'Work. Spanish trabajo, Dutch werk, and Papiamento took the Iberian one on a Dutch island.' },
    { text: 'tur dia', note: 'Every day. Spanish todos los dias, shortened.' },
    { text: 'masha', note: 'Very. Papiamento is a creole with Portuguese, Spanish, Dutch and African words in one sentence.' },
    { text: 'kayente', note: 'Hot. Spanish caliente, spelled as said.' },
  ],
  kal: [
    { text: 'pisuttuarluni', note: 'Walking. Greenlandic builds a whole clause into one word, as Inuktitut does in its own alphabet.' },
    { text: 'Naluara', note: 'I do not know it, with the object swallowed into the verb. Inuktitut does the same in syllabics; in Latin letters Greenlandic is alone in it.' },
    { text: 'aqqut', note: 'Road. Greenlandic doubles consonants constantly and glues whole sentences into one word; Danish, the other language of Greenland, does neither.' },
    { text: 'Ullaaq', note: 'Morning. Inuktitut writes the same language family in syllabics instead.' },
  ],
  yue: [
    { text: '唔', note: 'Not. Mandarin writes 不, and this character is the single fastest way to tell written Cantonese from written Chinese.' },
    { text: '佢', note: 'He or she. Mandarin 他, and this character is Cantonese and almost nothing else.' },
    { text: '咗', note: 'A completed action. Mandarin 了.' },
    { text: '邊度', note: 'Where. Mandarin 哪里, and these characters exist for Cantonese and almost nothing else.' },
  ],

  // Central and East Africa.
  run: [
    { text: 'canke', note: 'Or. Kinyarwanda writes cyangwa.' },
    { text: 'ategerezwa', note: 'Must. Kinyarwanda says agomba in the same sentence.' },
    { text: 'gateka', note: 'Rights, from agateka. Kinyarwanda says uburenganzira.' },
    { text: 'bwiwe', note: 'His or her, with the -iwe ending. Kinyarwanda writes bwe.' },
  ],

  // Central, East and Southern Africa.
  lua: [
    { text: 'bonsu', note: 'All, agreeing with bantu, people. Lingala says bato nyonso.' },
    { text: 'baledibwa', note: 'Are born. Lingala says na mbotama, Kongo bambutukanga.' },
    { text: 'udi ne', note: 'Has, literally is with. Lingala says azali na, Swahili ana.' },
    { text: 'ditunga', note: 'Country, in the di- class. Lingala says ekolo, Swahili nchi.' },
    { text: 'nansha', note: 'Even, as in nansha umwe, not even one. Lingala says ata moke te.' },
    { text: 'bukenji', note: 'A right. Lingala says likoki, Swahili haki.' },
  ],
  kng: [
    { text: 'Woso mutu', note: 'Everyone, every person. Kimbundu puts the same word after the noun, muthu woso, and Lingala says moto nyonso.' },
    { text: 'widi', note: 'Is, used here for has. Tshiluba says udi, Lingala azali.' },
    { text: 'mswa', note: 'A right. Lingala says likoki, Tshiluba bukenji.' },
    { text: 'Kwisi-ko', note: 'There is no, at the start of the sentence. Lingala marks the same negative with te after the noun.' },
    { text: 'nzo-mkanda', note: 'School, literally house of the book. Lingala borrows kelasi from French.' },
  ],
  kmb: [
    { text: 'O athu', note: 'The people, with the article o written as a word of its own. Umbundu joins it on: omanu.' },
    { text: 'kutokala', note: 'To be entitled to. Umbundu says okwete, has, and Kongo widi.' },
    { text: 'Seku muthu', note: 'No one, literally there is no person. Umbundu opens the same sentence with lomwe.' },
    { text: 'kubuluka', note: 'Freedom, being free. Umbundu says eyovo.' },
    { text: 'kimoxi', note: 'One, with x for the sh sound, as Portuguese spells it. Umbundu says mosi.' },
  ],
  umb: [
    { text: 'vosi', note: 'All. Kimbundu says woso, and writes the article apart: o athu woso.' },
    { text: 'Omunu eye omunu', note: 'Everyone. Kimbundu says muthu woso, Kongo woso mutu.' },
    { text: 'okwete', note: 'Has. Kimbundu says wala, Kongo widi.' },
    { text: 'ñg', note: 'Umbundu spelling writes ñ, as in owiñgi and ndañgo. Kimbundu and Kongo are written without it.' },
  ],
  cjk: [
    { text: 'mweswe', note: 'Every, in muthu mweswe, everyone. Luvale says mutu wosena, Lunda muntu wejima.' },
    { text: 'kanatela', note: 'Has the right to. Luvale says analusesa.' },
    { text: 'cifuci', note: 'Country, with c for the ch sound. Luvale says lifuchi, with ch.' },
    { text: 'cenyi', note: 'His, spelled with c. Luvale writes the same word chenyi.' },
    { text: 'Nyumwe', note: 'No one. Luvale says kakwechi, Lunda kosi muntu.' },
  ],
  lue: [
    { text: 'Vatu', note: 'People, with the va- prefix. Chokwe says athu, Lunda antu.' },
    { text: 'vosena', note: 'All, agreeing with vatu. Chokwe says eswe, Lunda ejima.' },
    { text: 'wosena', note: 'Every, in mutu wosena, everyone. Chokwe says muthu mweswe, Lunda muntu wejima.' },
    { text: 'analusesa', note: 'Has the right, from lusesa, a right. Chokwe says kanatela.' },
    { text: 'lifuchi', note: 'Country, in the li- class. Chokwe says cifuci, in the ci- class.' },
    { text: 'Kakwechi', note: 'There is no, opening a negative sentence. Chokwe says nyumwe, no one, and Lunda kosi.' },
  ],
  lun: [
    { text: 'Muntu wejima', note: 'Everyone, every person. Luvale says mutu wosena, Chokwe muthu mweswe.' },
    { text: 'Kosi muntu', note: 'No one. Luvale says kakwechi, Kaonde kafwako.' },
    { text: 'ing\'ovu', note: 'Strength, used for a right. Luvale says lusesa, Kaonde nsambu.' },
    { text: 'chakadi', note: 'Without. Luvale says chakuhona.' },
    { text: 'kwitung\'a', note: 'In a country, from itung\'a. Luvale says lifuchi, Kaonde kyalo.' },
  ],
  kqn: [
    { text: 'Yense', note: 'Everyone. Bemba says onse, Lunda muntu wejima.' },
    { text: 'uji na', note: 'Has, literally is with. Bemba says alikwata, Tonga ujisi.' },
    { text: 'kabiji', note: 'And, also. Tonga says alimwi.' },
    { text: 'kyalo', note: 'Country. Bemba writes the same word calo, with c where Kaonde has ky.' },
    { text: 'wafwainwa', note: 'Must, ought to. Bemba says afwile.' },
    { text: 'lufunjisho', note: 'Education. Bemba says amasambililo.' },
  ],
  bem: [
    { text: 'bafyalwa', note: 'Are born. Kaonde says basemwa, Tonga balazyalwa.' },
    { text: 'Takuli', note: 'There is no. Tonga says kunyina, Kaonde kafwako.' },
    { text: 'nangu', note: 'Or, even. Kaonde says nangwa, Tonga antela.' },
    { text: 'alikwata', note: 'Has, literally holds. Kaonde says uji na, Tonga ujisi.' },
    { text: 'insambu', note: 'A right. Kaonde writes nsambu, without the i- in front.' },
    { text: 'Tapali', note: 'There is no one. Tonga says kunyina, Kaonde kafwako.' },
  ],
  toi: [
    { text: 'oonse', note: 'All, every, with the long vowel written double. Bemba writes onse.' },
    { text: 'ulaangulukide', note: 'Is free to, has the right. Bemba says alikwata insambu.' },
    { text: 'Kunyina', note: 'There is no. Bemba says takuli, Kaonde kafwako.' },
    { text: 'antela', note: 'Or. Bemba says nangu, Kaonde nangwa.' },
    { text: 'alimwi', note: 'And, also. Kaonde says kabiji.' },
    { text: 'weelede', note: 'Should, with a doubled vowel. Bemba says afwile.' },
  ],
  loz: [
    { text: 'kaufela', note: 'All, every. In the same sentence Sesotho says bohle, Tswana botlhe.' },
    { text: 'swanelo', note: 'A right. Tswana writes the same word tshwanelo, and Sesotho says tokelo.' },
    { text: 'u na ni', note: 'Has. Sesotho and Tswana say o na le, with le where Lozi has ni.' },
    { text: 'Mang\'i ni mang\'i', note: 'Everyone. Sepedi says mang le mang, Sesotho motho e mong le e mong.' },
    { text: 'Ha kuna', note: 'There is no. Sesotho says ha ho, Tswana ga go.' },
  ],
  ndo: [
    { text: 'uuthemba', note: 'A right, with the long vowel written double. Umbundu says omoko.' },
    { text: 'kehe', note: 'Every, after the noun: omuntu kehe. Umbundu says omunu eye omunu.' },
    { text: 'Aantu', note: 'People, with a doubled vowel at the start. Umbundu says omanu.' },
    { text: 'Hamuntu', note: 'No one. Umbundu says lomwe.' },
    { text: 'nenge', note: 'Or. Umbundu says ndañgo, Swahili au.' },
    { text: 'oku na', note: 'Has, literally is with. Umbundu says okwete.' },
  ],
  sag: [
    { text: 'pëpëe', note: 'Not, closing the clause. Lingala also puts its negative at the end, but writes te.' },
    { text: 'kûê', note: 'All, every: zo kûê is everyone. Lingala says moto nyonso.' },
    { text: 'ngangü', note: 'Strength, used for a right. Lingala says likoki.' },
    { text: 'ködörö', note: 'Country. Lingala says ekolo, French pays.' },
    { text: 'lîngbi', note: 'Must, ought to, in alîngbi. Lingala says esengeli.' },
    { text: 'na yâ tî', note: 'Inside, in the middle of. Lingala says na kati ya.' },
  ],
  suk: [
    { text: 'Sekge', note: 'A right. Nyamwezi borrows haki from Swahili.' },
    { text: 'isoma', note: 'Schooling, education. Nyamwezi says ilimu, from Swahili elimu.' },
    { text: 'gumanhya', note: 'To gather. Nyamwezi says kusanja.' },
    { text: 'jakwe', note: 'His, agreeing with nsabo, property. Nyamwezi writes nsabo yakwe.' },
    { text: 'wiyabi', note: 'Freedom. Nyamwezi says wiyagalule.' },
  ],
  nym: [
    { text: 'wina haki', note: 'Has the right. Sukuma says alina sekge, Swahili ana haki.' },
    { text: 'kusanja', note: 'To gather. Sukuma says gumanhya.' },
    { text: 'biyagalulile', note: 'Free, as in born free. Sukuma says na wiyabi, with freedom.' },
  ],
  nyn: [
    { text: 'Tihariho', note: 'There is no. Luganda says tewali, Kinyarwanda nta.' },
    { text: 'Omuntu aine', note: 'A person has. Luganda says alina, Kinyarwanda afite.' },
    { text: 'shemereire', note: 'Ought to. Kinyarwanda says ukwiye, Luganda assanidde.' },
    { text: 'obugabe', note: 'A right. Luganda says eddembe, Kinyarwanda uburenganzira.' },
    { text: 'narishi', note: 'Or. Luganda says oba, Kirundi canke.' },
    { text: 'obwegyese', note: 'Education. Kinyarwanda says inyigisho, Luganda okuyigirizibwa.' },
  ],
  vmw: [
    { text: 'mutthu', note: 'Person, spelled with tth. Swahili says mtu, Yao mundu.' },
    { text: 'Wakunla', note: 'Every, before the noun. Swahili says kila, Chichewa aliyense.' },
    { text: 'ohaana', note: 'Has. Swahili says ana, Chichewa ali ndi.' },
    { text: 'edireito', note: 'A right: Portuguese direito with an e- prefix. Swahili says haki.' },
    { text: 'Khavo', note: 'Nobody, there is none. Chichewa says palibe.' },
    { text: 'othene', note: 'All. Swahili says wote, Yao wosope.' },
  ],
  kde: [
    { text: 'vohevohe', note: 'All, the word said twice. Swahili says wote, Yao wosope.' },
    { text: 'avele na', note: 'Has. Swahili says ana, Yao akwete.' },
    { text: 'wasa', note: 'A right. Swahili says haki, Yao ufulu.' },
    { text: 'dimali', note: 'Property, the Swahili word mali with a di- prefix added. Swahili writes mali yake, his property.' },
    { text: 'vanu', note: 'People. Swahili says watu, Yao wandu.' },
  ],
  yao: [
    { text: 'Wandu', note: 'People. Chichewa says anthu, Swahili watu.' },
    { text: 'wosope', note: 'All. Chichewa says onse, Makonde vohevohe.' },
    { text: 'jwalijose', note: 'Every, agreeing with mundu, person. Chichewa says aliyense.' },
    { text: 'akwete', note: 'Has. Chichewa says ali ndi, Makonde avele na.' },
    { text: 'chipanje', note: 'Property. Chichewa says chuma or katundu.' },
    { text: 'mpela', note: 'Like, as. Chichewa says ngati, Swahili kama.' },
  ],
  nso: [
    { text: 'ka moka', note: 'All. Sesotho says bohle, Tswana botlhe.' },
    { text: 'belegwe', note: 'Were born. Sesotho says tswetswe, Tswana tsetswe.' },
    { text: 'Mang le mang', note: 'Everyone. Sesotho writes motho e mong le e mong, Tswana mongwe le mongwe.' },
    { text: 'tšhireletšo', note: 'Protection, spelled with š. Tswana writes tshireletsego.' },
    { text: 'bjalo', note: 'Like, as, with the bj of Sepedi spelling. Tswana says jaaka, Sesotho jwalo.' },
    { text: 'amogwago', note: 'Be deprived, in a relative clause ending -go. Tswana and Sesotho end such verbs in -ng.' },
  ],
  tso: [
    { text: 'Munhu ni munhu', note: 'Everyone, person and person. Venda says muthu muṅwe na muṅwe, Zulu wonke umuntu.' },
    { text: 'nfanelo', note: 'A right. Venda says pfanelo, Zulu ilungelo.' },
    { text: 'Wihi na wihi', note: 'Everyone, whoever it is. Venda says muthu muṅwe na muṅwe.' },
    { text: 'À hava', note: 'There is no. Venda says a hu na, Zulu akekho.' },
  ],
  ssw: [
    { text: 'Bonkhe', note: 'All. Zulu writes bonke, with no h.' },
    { text: 'bantfu', note: 'People. Zulu writes abantu; Swati spells the same word with tf.' },
    { text: 'batalwa', note: 'Were born. Zulu says bazalwa, with z where Swati has t.' },
    { text: 'Wonkhe', note: 'Every. Zulu writes wonke, with no h.' },
    { text: 'umuntfu', note: 'Person. Zulu writes umuntu; the tf is Swati spelling.' },
    { text: 'lilungelo', note: 'A right. Zulu shortens unelilungelo to unelungelo.' },
    { text: 'Kute', note: 'There is none, no one. Zulu says akekho, Xhosa akukho.' },
    { text: 'emfundvweni', note: 'In education. Zulu writes imfundo, with no v.' },
    { text: 'emtsetfweni', note: 'In law. Zulu writes emthethweni.' },
  ],
  ven: [
    { text: 'vhoṱhe', note: 'All, with vh and a t marked underneath, ṱ. Sepedi says ka moka, Tsonga hin\'kwavu.' },
    { text: 'muṅwe', note: 'One, other: muthu muṅwe na muṅwe is everyone. Tsonga says munhu ni munhu.' },
    { text: 'pfanelo', note: 'A right. Tsonga says nfanelo, Sepedi tokelo.' },
    { text: 'mbofholowo', note: 'Freedom. Tsonga says nkhululeko, Sepedi tokologo.' },
    { text: 'A hu na', note: 'There is no. Sepedi says ga go, Tsonga a hava.' },
    { text: 'a ḓo', note: 'Will: a ḓo, he or she will, spelled with a dental ḓ. Sepedi marks the future with tla.' },
    { text: 'pfunzo', note: 'Education. Sepedi says thuto.' },
  ],

  // West Africa.
  pcm: [
    { text: 'anoda', note: 'Another. Krio says ɔda for other, and Tok Pisin narapela.' },
    { text: 'propati', note: 'Property. Krio writes the same word prɔpati, with an open o.' },
    { text: 'gree', note: 'Agree. Krio spells it gri.' },
    { text: 'no mata', note: 'No matter. Krio writes nɔ mata, and Tok Pisin says maski.' },
    { text: 'goment', note: 'Government. Krio says gɔvamɛnt, and Tok Pisin gavman.' },
    { text: 'kontri', note: 'Country. Krio writes kɔntri with an open o, and Tok Pisin kantri.' },
    { text: 'notin', note: 'Nothing. Krio says natin.' },
  ],
  kri: [
    { text: 'ebul', note: 'Able: ebul fɔ means can. Nigerian Pidgin says fit, and Tok Pisin inap.' },
    { text: 'Nɔbɔdi', note: 'Nobody, written with the open o, ɔ. Nigerian Pidgin writes nobodi, and Tok Pisin says nogat wanpela.' },
    { text: 'kɔmɔt', note: 'Come out, leave. Nigerian Pidgin has the same word and spells it comot.' },
    { text: 'in yon', note: 'His own. Nigerian Pidgin says im own.' },
    { text: 'gɔvamɛnt', note: 'Government. Nigerian Pidgin says goment, and Tok Pisin gavman.' },
    { text: 'dɛn', note: 'The plural, after the noun: pipul dɛn, the people. Tok Pisin puts ol in front instead.' },
    { text: 'rayt', note: 'A right. Nigerian Pidgin keeps the English spelling, right, and Tok Pisin writes rait.' },
  ],
  kea: [
    { text: 'drêto', note: 'A right. Portuguese says direito.' },
    { text: 'nacionalidadi', note: 'Nationality. Portuguese says nacionalidade; Cape Verdean ends it in i.' },
    { text: 'educaçon', note: 'Education. Portuguese writes educação; Cape Verdean spells the ending -çon.' },
    { text: 'calquer', note: 'Any. Portuguese writes qualquer.' },
    { text: 'trabadjo', note: 'Work. Portuguese says trabalho and Papiamento trabou; Cape Verdean writes dj where Portuguese has lh.' },
    { text: 'fidjo', note: 'Son, child. Portuguese filho: Cape Verdean writes dj where Portuguese has lh.' },
  ],
  ewe: [
    { text: 'amesiame', note: 'Everyone. Fon says gbɛtɔ bǐ, Ga mɔ fɛɛ mɔ and Dangme nɔ fɛɛ nɔ.' },
    { text: 'ƒe', note: 'Of, the possessive word. Ewe writes ƒ for an f made with both lips; Fon, Ga and Dangme have no such letter.' },
    { text: 'aɖeke', note: 'Any, in a negative sentence that ends with o. Fon ends its negatives with ǎ instead.' },
    { text: 'Mɔnukpɔkpɔ', note: 'A right, an opportunity. Fon says acɛ, and Ga hegbɛ.' },
    { text: 'kple', note: 'And, with. Fon says kpo, and Ga and Dangme kɛ.' },
  ],
  fon: [
    { text: 'Gbɛtɔ', note: 'A person, a human being. Ewe says amegbetɔ, and Ga gbɔmɔ.' },
    { text: 'ǎ', note: 'The negative word that closes the sentence. Ewe closes a negative with o instead.' },
    { text: 'sixu', note: 'Can, be able to. Ewe says ate ŋu.' },
    { text: 'acɛ', note: 'A right. Ewe says mɔnukpɔkpɔ, and Ga hegbɛ.' },
  ],
  gaa: [
    { text: 'Mɔ fɛɛ mɔ', note: 'Everyone, literally person every person. Dangme says nɔ fɛɛ nɔ, and Ewe amesiame.' },
    { text: 'hegbɛ', note: 'A right. Dangme says he blɔ, and Ewe mɔnukpɔkpɔ.' },
    { text: 'Esaaa', note: 'Should not: esa, it is fitting, negated by writing its vowel three times. Ewe negates with a separate o at the end.' },
  ],
  ada: [
    { text: 'Nɔ fɛɛ nɔ', note: 'Everyone. Ga says mɔ fɛɛ mɔ, with m where Dangme has n.' },
    { text: 'ngɛ', note: 'Is, has. Ga says yɛ in the same place: mɔ fɛɛ mɔ yɛ hegbɛ.' },
    { text: 'he blɔ', note: 'A right. Ga says hegbɛ, and Ewe mɔnukpɔkpɔ.' },
    { text: 'kasemi', note: 'Learning. Dangme nouns made from verbs end in -mi, where Ga uses -mɔ, as in nikasemɔ.' },
    { text: 'tsumi', note: 'Work. Ga says nitsumɔ, with -mɔ where Dangme has -mi.' },
    { text: 'Nɔ tsuaa nɔ', note: 'Every person. Ga says mɔ fɛɛ mɔ.' },
    { text: 'nɔ fɛɛ nɔ', note: 'Everyone. Ga says mɔ fɛɛ mɔ, with m where Dangme has n.' },
  ],
  bci: [
    { text: 'kwlakwla', note: 'Every. Akan says biara, and Nzema biala.' },
    { text: 'Sran', note: 'Person. Akan says onipa, and Nzema sonla.' },
    { text: 'fata kɛ', note: 'Must, it is right that. Akan says ɛsɛ sɛ.' },
    { text: '-man', note: 'The negative, hyphened onto the verb: wlu-man, not enter. Akan puts a nasal in front of the verb instead.' },
    { text: 'kwla\'a', note: 'Cannot. Akan says ntumi.' },
  ],
  nzi: [
    { text: 'biala', note: 'Every. Akan says biara, with r where Nzema has l, and Baoulé kwlakwla.' },
    { text: 'adenle', note: 'A right, literally a way or road. Akan also uses its word for way, kwan, for a right.' },
    { text: 'Ɔnle kɛ', note: 'Should not. Akan says ɛnsɛ sɛ.' },
    { text: 'sonla', note: 'Person. Akan says onipa, and Baoulé sran.' },
  ],
  mos: [
    { text: 'fãa', note: 'All, every. Dagbani says zaa.' },
    { text: 'tõe', note: 'Can. Dagbani says tooi, without the tilde that marks a nasal vowel.' },
    { text: 'tara sor', note: 'Has the right, literally has the road. Dagbani says mali soli.' },
  ],
  dag: [
    { text: 'sokam', note: 'Everyone. Mooré says ned fãa, and Hausa kowa.' },
    { text: 'tooi', note: 'Can, be able to. Mooré says tõe, and Hausa iya.' },
    { text: 'zuɣu', note: 'Head, and on or about. Mooré says zugu, and neither Mooré nor Hausa spelling has the letter ɣ.' },
  ],
  tiv: [
    { text: 'Hanmaor', note: 'Every person: hanma, every, and or, person. Hausa says kowane mutum.' },
    { text: 'makeranta', note: 'School, borrowed from Hausa makaranta and respelled.' },
    { text: 'Makeranta', note: 'School, borrowed from Hausa makaranta and respelled.' },
    { text: 'kwagh', note: 'Thing, matter. Hausa says abu.' },
    { text: 'cii', note: 'All, every one. Hausa says duk.' },
  ],
  ibb: [
    { text: 'enyene', note: 'Has. Igbo says nwere.' },
    { text: 'ekededi', note: 'Any, every. Igbo says ọ bụla.' },
    { text: 'inyeneke', note: 'Has not, with the negative ending -ke. Igbo negates with -ghị, as in amaghị.' },
    { text: 'ndomokiet', note: 'Not one, nobody. Igbo says ọ dịghị onye.' },
    { text: 'unen', note: 'A right. Igbo says ikike, and Yoruba ẹ̀tọ́.' },
  ],
  bin: [
    { text: 'Domwande-omwan', note: 'Everyone, each person. Yoruba says ẹnì kọ̀ọ̀kan.' },
    { text: 'domwande-omwan', note: 'Everyone, each person. Yoruba says ẹnì kọ̀ọ̀kan.' },
    { text: 'mween', note: 'Has. Yoruba says ní, and Igbo nwere.' },
    { text: 'vbe', note: 'In, at. Edo spells a sound between v and w as vb, which Yoruba and Igbo spelling never does.' },
    { text: 'khian', note: 'Will, shall. The kh is a sound Yoruba does not have.' },
  ],
  sus: [
    { text: 'birin', note: 'All, every. Maninka and Bambara say bɛɛ.' },
    { text: 'Mixi', note: 'Person. Maninka says mɔɔ, and Bambara mɔgɔ.' },
    { text: 'keren', note: 'One. Maninka and Bambara say kelen, with l where Susu has r.' },
    { text: 'Ndende', note: 'No one. Maninka says mɔɔ si, and Bambara mɔgɔ si.' },
    { text: 'naxan', note: 'Who, which. Maninka and Bambara say min.' },
  ],
  emk: [
    { text: 'Mɔɔ', note: 'Person. Bambara says mɔgɔ; Maninka drops the g.' },
    { text: 'Karan', note: 'Study, school. Bambara says kalan, with l where Maninka has r.' },
    { text: 'karan', note: 'Study, school. Bambara says kalan, with l where Maninka has r.' },
    { text: 'denbatiilu', note: 'Parents, with the plural -lu. Bambara marks plurals with -w.' },
    { text: 'Adamadennu', note: 'Human beings, with the plural -nu. Bambara marks plurals with -w.' },
  ],
  snk: [
    { text: 'Sere su', note: 'Every person. Bambara says mɔgɔ bɛɛ.' },
    { text: 'raawa', note: 'Can, may. Bambara and Maninka say se.' },
    { text: 'ra nta', note: 'Cannot. Bambara says tɛ se.' },
    { text: 'nan siri', note: 'Must. Bambara says ka kan ka.' },
    { text: 'jamaane', note: 'Country. Bambara and Maninka say jamana.' },
    { text: 'taqu', note: 'A right. Soninke writes q for a k made far back in the throat, a letter Bambara spelling lacks.' },
  ],
  men: [
    { text: 'lɔnya', note: 'A right. Temne says ʌmari, and Krio rayt.' },
    { text: 'Nuu gbi', note: 'Everyone. Temne says wuni o wuni, and Krio ɛvribɔdi.' },
    { text: 'nuu gbi', note: 'Everyone. Temne says wuni o wuni, and Krio ɛvribɔdi.' },
    { text: 'sawei', note: 'The law. Krio says di lɔ.' },
  ],
  tem: [
    { text: 'Wuni o wuni', note: 'Everyone. Mende says nuu gbi, and Krio ɛvribɔdi.' },
    { text: 'ʌmari', note: 'A right. Mende says lɔnya, and Krio rayt.' },
    { text: 'ʌŋdina', note: 'Religion, from Arabic din. Krio says rilijɔn.' },
  ],
  srr: [
    { text: 'Oxuu', note: 'Everyone. Wolof says nit ku ne, and Pulaar neɗɗo kala.' },
    { text: 'O leng', note: 'No one. Wolof says kenn, and Pulaar hay gooto.' },
  ],
  dyo: [
    { text: 'druwa', note: 'A right, from French droit. Wolof says sañ-sañ.' },
    { text: 'Anoosan', note: 'Everyone. Wolof says nit ku ne.' },
    { text: 'letuŋoolen', note: 'May not, cannot. Wolof says mënuñu.' },
  ],
  fuc: [
    { text: 'Neɗɗo kala', note: 'Every person. Wolof says nit ku ne.' },
    { text: 'Hay gooto', note: 'No one. Wolof says kenn, and Serer o leng.' },
    { text: 'hakke', note: 'A right, from Arabic haqq. Wolof says sañ-sañ.' },
    { text: 'Jaŋde', note: 'Learning, schooling. Wolof says njàng.' },
    { text: 'Yimɓe fof', note: 'All people. Wolof says népp, and writes no hooked letters like ɓ.' },
  ],

  // South-East Asia, north-east India and the Pacific.
  mad: [
    { text: 'dha-padha', note: 'Equal: padha with its last syllable copied in front of it. Javanese says kang padha, Indonesian yang sama.' },
    { text: 'Tadha\' oreng', note: 'No one. Indonesian says tak seorang pun, Javanese ora ana uwong.' },
    { text: 'etangkep', note: 'Arrested. Madurese makes the passive with e-, where Indonesian and Javanese write ditangkap and ditangkep.' },
    { text: 'otaba', note: 'Or. Indonesian says atau, Javanese utawa.' },
    { text: 'agadhuwi', note: 'Has. Indonesian says mempunyai, Javanese duwe.' },
    { text: 'settong', note: 'One. Indonesian says satu, Javanese siji.' },
    { text: 'pandhidhigan', note: 'Education. Indonesian says pendidikan, Javanese pawiyatan.' },
  ],
  min: [
    { text: 'punyo', note: 'Has. Indonesian says punya: Minangkabau often ends a word in o where Indonesian has a, as in samo for sama.' },
    { text: 'nan samo', note: 'The same. Indonesian says yang sama.' },
    { text: 'Tiok urang', note: 'Everyone. Indonesian says setiap orang.' },
    { text: 'untuak', note: 'For, to. Indonesian says untuk.' },
    { text: 'masuak', note: 'Enter, join. Indonesian says masuk: Minangkabau turns a final uk into uak.' },
    { text: 'Indak surang pun', note: 'No one. Indonesian says tidak seorang pun.' },
    { text: 'buliah', note: 'May, is allowed. Indonesian says boleh.' },
    { text: 'sacaro', note: 'In a manner, as in arbitrarily. Indonesian says secara.' },
    { text: 'mandapek', note: 'To get. Indonesian says mendapat.' },
  ],
  ban: [
    { text: 'sane pateh', note: 'The same. Javanese says kang padha, Indonesian yang sama.' },
    { text: 'maduwe', note: 'Has. Javanese says duwe or darbe, Indonesian mempunyai.' },
    { text: 'nenten', note: 'Not, in polite Balinese. Javanese says ora, Indonesian tidak.' },
    { text: 'Saluiring janma', note: 'Every person. Javanese says saben uwong, Indonesian setiap orang.' },
    { text: 'sekha', note: 'A club or association. Indonesian says perkumpulan, Javanese paguyuban.' },
    { text: 'polih', note: 'To get. Javanese says oleh, Indonesian mendapat.' },
  ],
  bug: [
    { text: 'Degaga', note: 'There is not: degaga seddi tau is no one. Indonesian says tidak seorang pun.' },
    { text: 'wedding', note: 'May, is allowed, and nothing to do with the English word. Indonesian says boleh.' },
    { text: 'seddi', note: 'One. Indonesian says satu or se-, as in seorang.' },
    { text: 'Sininna rupa tau', note: 'Every person, all people. Indonesian says setiap orang.' },
    { text: 'nappunai', note: 'Has. Indonesian says mempunyai.' },
    { text: 'kebebasang', note: 'Freedom. Indonesian writes kebebasan; Buginese ends it in ng, as it turns hukum into hukung.' },
    { text: 'massikola', note: 'To go to school. Indonesian says bersekolah.' },
  ],
  ace: [
    { text: 'Bandum', note: 'All. Indonesian says semua.' },
    { text: 'nyang sama', note: 'The same. Indonesian says yang sama.' },
    { text: 'deungon', note: 'With. Indonesian says dengan.' },
    { text: 'geutanyoe', note: 'We, including you. Indonesian says kita.' },
    { text: 'atee', note: 'Heart, conscience. Indonesian says hati.' },
    { text: 'meukawen', note: 'To marry, with the Acehnese prefix meu-. Indonesian says kawin or nikah.' },
    { text: 'neugara', note: 'Country. Indonesian writes negara.' },
  ],
  iba: [
    { text: 'enggau', note: 'And, with. Malay and Indonesian say dan or dengan.' },
    { text: 'ngirup', note: 'Drink. Malay and Indonesian say minum.' },
    { text: 'Enti', note: 'If. Malay says kalau or jika.' },
    { text: 'bisi mayuh', note: 'Have many. Malay says ada banyak.' },
    { text: 'diatu', note: 'Now. Malay says sekarang.' },
    { text: 'makai', note: 'Eat. Malay says makan.' },
    { text: 'pulai', note: 'Go home. Malay says pulang: Iban often ends in ai where Malay has an, ang or ar.' },
    { text: 'besai', note: 'Big. Malay says besar.' },
  ],
  hil: [
    { text: 'katarungan', note: 'A right, as in human rights. Cebuano says katungod, Waray katadungan, Tagalog karapatan.' },
    { text: 'hilway', note: 'Free, and kahilwayan is freedom. Tagalog says malaya and kalayaan, Cebuano kagawasan.' },
    { text: 'ginbun-ag', note: 'Was born, with the past prefix gin-. Cebuano uses gi-, as in gipakatawo.' },
    { text: 'sin-o', note: 'Who, with a hyphen for the glottal stop. Tagalog writes sino, Cebuano kinsa.' },
    { text: 'Wala sing', note: 'None, as in no one. Cebuano says walay bisan kinsa, Tagalog walang sino man.' },
    { text: 'tagsa tagsa', note: 'Each one. Cebuano says matag usa, Tagalog bawat tao.' },
  ],
  war: [
    { text: 'uripon', note: 'Slave. Cebuano and Hiligaynon say ulipon: Waray often has r where they have l.' },
    { text: 'katadungan', note: 'A right. Hiligaynon says katarungan, Cebuano katungod, Tagalog karapatan.' },
    { text: 'kalugaringon', note: 'Oneself, your own. Cebuano says kaugalingon.' },
    { text: 'han iya', note: 'His or her. Cebuano says sa iyang, Hiligaynon sa iya.' },
    { text: 'Diri', note: 'Not. Cebuano says dili, Tagalog hindi.' },
    { text: 'mayda', note: 'Has. Cebuano says adunay, Tagalog and Hiligaynon may.' },
    { text: 'kag-anak', note: 'Parents. Cebuano and Hiligaynon say ginikanan, Tagalog magulang.' },
    { text: 'han ira', note: 'Their. Cebuano says sa ilang, Hiligaynon sa ila.' },
  ],
  pam: [
    { text: 'balang metung', note: 'Each one. Metung is one, where Tagalog says isa.' },
    { text: 'atin lang', note: 'They have. Tagalog uses may here, and atin means ours in Tagalog.' },
    { text: 'atin iyang', note: 'He or she has. Tagalog uses may here, and atin means ours in Tagalog.' },
    { text: 'Alang ninu', note: 'No one: ninu is who, where Tagalog says sino, so alang ninu man is walang sino man.' },
    { text: 'antimong', note: 'As, like. Tagalog says bilang.' },
  ],
  bcl: [
    { text: 'gabos', note: 'All. Tagalog says lahat, Cebuano tanan.' },
    { text: 'katalinkasan', note: 'Freedom. Tagalog says kalayaan, Hiligaynon kahilwayan.' },
    { text: 'lambang saro', note: 'Each one. Saro is one, where Tagalog says isa and Cebuano usa.' },
    { text: 'igwa nin', note: 'Has. Tagalog says may, Cebuano adunay.' },
    { text: 'siisay', note: 'Who. Tagalog says sino, Cebuano kinsa.' },
    { text: 'Mayo nin', note: 'None, as in no one. Tagalog says wala, Cebuano walay.' },
    { text: 'saiyang', note: 'His or her. Tagalog says kanyang.' },
  ],
  pag: [
    { text: 'Saray', note: 'The, for more than one. Tagalog says ang mga.' },
    { text: 'baleg', note: 'Big. Tagalog says malaki, Ilocano dakkel.' },
    { text: 'mabiskeg', note: 'Strong. Tagalog says malakas.' },
    { text: 'Anggapo', note: 'There is none. Tagalog says wala, Ilocano awan.' },
    { text: 'labat', note: 'Only, just. Tagalog says lamang.' },
    { text: 'Agko amta', note: 'I do not know. Ilocano says diak ammo, Tagalog hindi ko alam.' },
    { text: 'Iner', note: 'Where. Tagalog says saan, Ilocano sadino.' },
  ],
  kha: [
    { text: 'bynriew', note: 'Human being. Mizo says mihring.' },
    { text: 'laitluid', note: 'Free. Mizo says zalên, Hakha Chin zalong.' },
    { text: 'ki hok', note: 'The rights, with the plural article ki. Mizo says chanvo for a right.' },
    { text: 'Uwei pa kawei', note: 'Everyone, built from wei, one, with the masculine u and the feminine ka. Mizo says mitinte.' },
    { text: 'jingïada', note: 'Protection, a noun made with the prefix jing-. Mizo makes nouns with -na on the end instead.' },
    { text: 'Ym don', note: 'There is not. Khasi puts ym before the verb, where Mizo puts lo after it.' },
    { text: 'aiñ', note: 'Law. Mizo says dan, Hakha Chin upadi.' },
    { text: 'jingnang jingstad', note: 'Education. Mizo says zirna, Hakha Chin cacawn.' },
  ],
  lus: [
    { text: 'chanvo', note: 'A right, what a person is due. Hakha Chin says nawl.' },
    { text: 'an nei', note: 'They have. Hakha Chin says an ngei.' },
    { text: 'Mi tumah', note: 'No one. Hakha Chin says ahohmanh.' },
    { text: 'tur a ni lo', note: 'Must not be. Hakha Chin says ding a si lai lo, with si where Mizo has ni.' },
    { text: 'zalên', note: 'Free. Hakha Chin writes zalong.' },
    { text: 'Mitinte', note: 'Everyone. Hakha Chin says mi vialte.' },
    { text: 'Zirna', note: 'Education, with the noun ending -na. Hakha Chin says cacawn.' },
    { text: 'chhungah', note: 'Inside. Hakha Chin writes chungah.' },
  ],
  cnh: [
    { text: 'nawl', note: 'A right, permission. Mizo says chanvo.' },
    { text: 'vialte', note: 'All, every. Mizo says zawng zawng or mitinte.' },
    { text: 'ngei', note: 'Have. Mizo says nei, without the g.' },
    { text: 'upadi', note: 'Law, borrowed from Burmese. Mizo says dan.' },
    { text: 'a si lai', note: 'Will be. Mizo has ni where Hakha Chin has si: tur a ni.' },
    { text: 'Ahohmanh', note: 'No one. Mizo says mi tumah.' },
    { text: 'cacawn', note: 'Learning, education. Mizo says zirna.' },
    { text: 'zalong', note: 'Free. Mizo writes zalên.' },
  ],
  tah: [
    { text: 'ta\'ata', note: 'Person. Maori and Tongan say tangata, Samoan tagata: Tahitian dropped the ng and writes a glottal stop.' },
    { text: '\'Eiaha', note: 'Must not. Maori says kaua, Samoan e leai, Hawaiian ʻaʻole.' },
    { text: 'ti\'amanara\'a', note: 'A right. Maori says tika, Samoan aia tatau, Tongan totonu.' },
    { text: 'ato\'a', note: 'All. Maori says katoa, Tongan kotoa.' },
    { text: 'hō\'ē', note: 'One, a. Maori says tetahi, Cook Islands Maori tetai.' },
    { text: 'ha\'api\'ira\'a', note: 'Education. Maori says matauranga, Cook Islands Maori apiianga.' },
  ],
  rar: [
    { text: 'Auraka', note: 'Must not. Maori says kaua, Tahitian \'eiaha.' },
    { text: 'tikaanga', note: 'A right. Maori says tika, Tahitian ti\'amanara\'a.' },
    { text: 'tetai', note: 'A, some. Maori writes tetahi, and Cook Islands Maori drops the h.' },
    { text: 'akangere', note: 'Deprived, with the causative prefix aka-. Maori writes whaka-, Hawaiian hoʻo-.' },
    { text: 'akaruke', note: 'To leave, with the causative prefix aka-. Maori writes whaka-, Tahitian fa\'a-.' },
    { text: 'enua', note: 'Land, country. Maori says whenua, Tahitian fenua.' },
    { text: 'apiianga', note: 'Education. Maori says matauranga, Tahitian ha\'api\'ira\'a.' },
    { text: 'tatakitai', note: 'Each one. Tahitian says tata\'itahi, Maori ia tangata.' },
  ],
  niu: [
    { text: 'pogipogi', note: 'Morning. Tongan writes pongipongi: Niuean spells the ng sound g, as Samoan does.' },
    { text: 'higoa', note: 'Name. Tongan says hingoa, Samoan igoa.' },
    { text: 'gahua', note: 'Work. Tongan says ngāue, Samoan galuega.' },
    { text: 'Fakaalofa', note: 'Hello, from alofa, love. Samoan greets with talofa, Tongan with mālō e lelei.' },
  ],
  cha: [
    { text: 'mangai', note: 'They have, with the plural man-. Tagalog says may, Spanish tienen.' },
    { text: 'man gai', note: 'They have, with the plural man. Tagalog says may, Spanish tienen.' },
    { text: 'linala', note: 'Life. Spanish says vida, Tagalog buhay.' },
    { text: 'gi menan i lai', note: 'Before the law. Tagalog says sa harap ng batas, Spanish ante la ley.' },
    { text: 'Taya', note: 'None, no one. Tagalog says wala, Spanish nadie.' },
    { text: 'inaresta', note: 'Arrest: Chamorro makes nouns with -in-, as haso, think, gives hinaso, thought. Tagalog says pagdakip.' },
    { text: 'properdadna', note: 'His property: a Spanish noun with the Chamorro possessive -na on the end, where Spanish puts su in front.' },
    { text: 'educasion', note: 'Education, the Spanish word spelled with s. Tagalog writes edukasyon, Bikol educacion.' },
  ],
  mah: [
    { text: 'Kajojo armij', note: 'Every person. Palauan says ar bek \'l chad, Chamorro todo.' },
    { text: 'anemkwoj', note: 'Freedom. Chamorro says libertad, from Spanish.' },
    { text: 'maron', note: 'A right, also power. Chamorro says derecho, Palauan llemalt.' },
    { text: 'ejelok', note: 'There is none, no one. Palauan says ngdiak, Chamorro taya.' },
    { text: 'jelalokijen', note: 'Education. Chamorro borrows educasion from Spanish.' },
  ],
  pau: [
    { text: 'Ar bek \'l chad', note: 'Every person. Marshallese says kajojo armij, Chamorro todo.' },
    { text: 'ngarngii', note: 'There is, has. Marshallese says eor, Chamorro gai.' },
    { text: 'llemeltir', note: 'A right. Chamorro says derecho, from Spanish, and Marshallese maron.' },
    { text: 'Ngdiak', note: 'There is not, no one. Marshallese says ejelok, Chamorro taya.' },
    { text: 'malechub', note: 'Or. Chamorro says pat, Marshallese ak.' },
    { text: 'beluu', note: 'Country, home village. Marshallese says lol, Chamorro tano.' },
  ],
  bis: [
    { text: 'raet', note: 'Right, spelled as it sounds. Tok Pisin writes rait.' },
    { text: 'ikwol', note: 'Equal. Tok Pisin says wankain.' },
    { text: 'Evriwan', note: 'Everyone. Tok Pisin says olgeta.' },
    { text: 'blong', note: 'Of, for. Tok Pisin writes bilong.' },
    { text: 'narafala', note: 'Other. Tok Pisin says narapela: Bislama has -fala where Tok Pisin has -pela.' },
    { text: 'edukeisen', note: 'Education. Tok Pisin writes edukesen.' },
    { text: 'Bambae', note: 'Will, the future marker. Tok Pisin says bai.' },
  ],

  // Regional Europe and the Americas.
  nds: [
    { text: 'Minschen', note: 'People. German Menschen, Dutch mensen: Low German has an i where both have an e.' },
    { text: 'sünd', note: 'Are. German sind, Dutch zijn.' },
    { text: 'Keeneen', note: 'No one. German and Dutch both say niemand.' },
    { text: 'dröff', note: 'May, is allowed to. German darf, Dutch mag.' },
    { text: 'Elk un een', note: 'Everyone, literally each and one. German says jeder, Dutch een ieder.' },
    { text: 'hett', note: 'Has. German hat, Dutch heeft, Luxembourgish huet.' },
  ],
  sco: [
    { text: 'Awbody', note: 'Everybody. Scots writes aw where English writes all.' },
    { text: 'Naebody', note: 'Nobody. Scots nae is English no.' },
    { text: 'richt', note: 'Right. Scots still says and writes the ch sound that English dropped from this word.' },
    { text: 'gart thole', note: 'Made to suffer. Gar and thole are old verbs that standard English no longer uses.' },
    { text: 'his lane', note: 'Alone, literally his lone. English would say by himself.' },
  ],
  vec: [
    { text: 'Tuti', note: 'All. Italian tutti, Friulian ducj: Venetian drops the double t.' },
    { text: 'teƚa', note: 'Part of in teƚa, in the. Italian says nella; some Venetian spelling bars an l that is barely said.' },
    { text: 'I xe', note: 'They are. Venetian xe does for both is and are; Italian says è and sono.' },
    { text: 'dirito', note: 'Right. Italian diritto, Friulian derit.' },
    { text: 'aƚa', note: 'To the. Italian alla, and the barred l marks an l that Venetian barely says.' },
    { text: 'pòl essar', note: 'Can be. Italian può essere, Friulian pò jessi.' },
    { text: 'detenudo', note: 'Detained. Italian detenuto: Venetian softens the t between vowels to a d.' },
  ],
  wln: [
    { text: 'dreût', note: 'Right, in the legal sense. French droit.' },
    { text: 'Chaskeun', note: 'Each one, everyone. French chacun.' },
    { text: 'Nolu', note: 'Nobody. French says nul or personne.' },
    { text: 'åcion', note: 'The ending French writes -ation, here spelled with the Walloon å.' },
    { text: 'sins', note: 'Without. French sans.' },
    { text: 'rêzon', note: 'Reason. French raison.' },
    { text: 'avou', note: 'With. French says avec.' },
  ],
  cos: [
    { text: 'Hà dirittu', note: 'Has the right. Italian ha diritto: Corsican puts a grave on hà and ends the noun in u.' },
    { text: 'hà dirittu', note: 'Has the right. Italian ha diritto: Corsican puts a grave on hà and ends the noun in u.' },
    { text: 'nimu', note: 'Nobody. Italian nessuno, Sicilian nuddu.' },
    { text: 'ghj', note: 'Corsican spells raghjoni, reason, with ghj. Italian writes ragione.' },
    { text: 'Ugnunu', note: 'Everyone. Italian ognuno.' },
    { text: 'parsona', note: 'Person. Italian persona: Corsican often has ar where Italian has er.' },
  ],
  gag: [
    { text: 'insanın var', note: 'Has, literally there is: Gagauz puts var before what is had. Turkish puts it last, hakkı vardır.' },
    { text: 'hakı', note: 'Right, with one k. Turkish writes hakkı.' },
    { text: 'diil', note: 'Not. Turkish değil, Azerbaijani deyil.' },
    { text: 'lääzım', note: 'Must, with a long ä. Turkish writes lazım.' },
    { text: 'zakonsuz', note: 'Unlawfully, from Russian zakon, law. Turkish says keyfi olarak here.' },
    { text: 'üürenmäk', note: 'Learning. Turkish öğrenmek: Gagauz writes a long vowel where Turkish has ğ, and ä for the last e.' },
    { text: 'birliktä', note: 'Together. Turkish birlikte: Gagauz writes this ending with ä.' },
  ],
  lim: [
    { text: 'neet', note: 'Not. Dutch niet, German nicht.' },
    { text: 'versjtaon', note: 'Understand. Dutch versta, German verstehe: Limburgish writes the sh sound before a t as sj.' },
    { text: 'höb', note: 'Have. Dutch heb, German habe.' },
    { text: 'Gelökkige', note: 'Happy. Dutch writes gelukkige.' },
    { text: 'verjaordaag', note: 'Birthday. Dutch verjaardag: ao is a Limburgish vowel spelling that Dutch does not use.' },
    { text: 'Wieveil', note: 'How much. Dutch hoeveel, German wie viel.' },
  ],
  scn: [
    { text: 'piaciunu', note: 'They please. Italian piacciono, and Sicilian ends this form in -unu.' },
    { text: 'Iddu', note: 'He. Italian lui, Corsican ellu: where Latin had ll, Sicilian says dd.' },
    { text: 'travagghi', note: 'Work, as noun or verb. Italian lavoro, Corsican travagliu: Sicilian writes gghi where Corsican has gli.' },
    { text: 'sunnu', note: 'They are. Italian sono, Corsican sò.' },
    { text: 'sempri', note: 'Always. Italian sempre: Sicilian ends in i where Italian ends in e.' },
    { text: 'manciàtu', note: 'Eaten. Italian mangiato.' },
  ],
  nap: [
    { text: 'Nisciuno', note: 'Nobody. Italian nessuno, Sicilian nuddu.' },
    { text: 'friddo', note: 'Cold. Italian freddo, Sicilian friddu.' },
    { text: 'accattà', note: 'To buy, with the ending cut off. Italian comprare, Sicilian accattari.' },
    { text: 'quanno', note: 'When. Italian quando, Sicilian quannu.' },
    { text: 'ncoppa', note: 'On top of. Italian sopra.' },
    { text: 'piccerillo', note: 'Little. Italian piccolo, Sicilian picciriddu.' },
    { text: 'assaje', note: 'Very, a lot. Italian molto, Sicilian assai.' },
    { text: 'jocà', note: 'To play. Italian giocare: Neapolitan writes a j and drops the ending.' },
  ],
  lij: [
    { text: 'ceuve', note: 'Rains. Italian piove, Piedmontese pieuv: Ligurian turns that pi into ce.' },
    { text: 'ciù', note: 'More. Italian più, Venetian pi.' },
    { text: 'tegnî', note: 'To hold. Italian tenere: Ligurian drops the -re and writes the long vowel left behind with a circumflex.' },
    { text: 'ægua', note: 'Water. Italian acqua: the æ is a Ligurian letter Italian does not have.' },
    { text: 'feugo', note: 'Fire. Italian fuoco, Piedmontese feu.' },
    { text: 'Unna', note: 'A, one. Italian una: Ligurian writes a double n.' },
    { text: 'figgeu', note: 'Boy. Italian ragazzo, Piedmontese fieul.' },
  ],
  pms: [
    { text: 'pieuv', note: 'Rains. Italian piove, Ligurian ceuve.' },
    { text: 'staroma', note: 'We will stay. Piedmontese ends the we form in -oma; Italian says staremo, Ligurian stemmo.' },
    { text: 'nèn', note: 'Not, placed after the verb. Italian puts non in front of it.' },
    { text: 'bon-a', note: 'Good, feminine. The hyphen marks an ng sound; Ligurian writes the same sound as ñ, in boña.' },
    { text: 'Chiel', note: 'He. Italian lui, Ligurian lê.' },
  ],
  frr: [
    { text: 'weet ek', note: 'Do not know. Dutch weet niet, Low German weet nich: North Frisian says ek for not.' },
    { text: 'Miaren', note: 'Morning. German Morgen, West Frisian moarn.' },
    { text: 'niin', note: 'No, none. German kein, Dutch geen, West Frisian gjin.' },
    { text: 'Deling', note: 'Today. German heute, Dutch vandaag, West Frisian hjoed.' },
    { text: 'jüster', note: 'Yesterday. German gestern, Dutch gisteren.' },
    { text: 'ark Dai', note: 'Every day. German jeden Tag, West Frisian alle dagen.' },
    { text: 'Wü haa', note: 'We have. German wir haben, West Frisian wy hawwe.' },
  ],
  dsb: [
    { text: 'pšosym', note: 'Please. Polish proszę, Upper Sorbian prošu: Lower Sorbian turns pr into pš.' },
    { text: 'pšawo', note: 'Right, from the root of Polish and Upper Sorbian prawo. Lower Sorbian turns pr into pš.' },
    { text: 'pśijaśelka', note: 'Friend. Polish przyjaciółka: Lower Sorbian writes pś where Polish writes prz.' },
    { text: 'rejowaś', note: 'To dance. Lower Sorbian infinitives end in -ś; Upper Sorbian and Polish ones end in -ć.' },
    { text: 'knigły', note: 'Books. Upper Sorbian and Czech say knihi and knihy: Lower Sorbian keeps the g.' },
    { text: 'zagroźe', note: 'In the garden. Upper Sorbian zahrodźe has h and dź where Lower Sorbian has g and ź.' },
  ],
  csb: [
    { text: 'Mëszlã', note: 'I think. Polish myślę: Kashubian has ë for a short vowel and ã where Polish has ę.' },
    { text: 'môsz', note: 'You have. Polish masz, Silesian mŏsz.' },
    { text: 'Jô móm', note: 'I have. Polish ja mam, Silesian jŏ mōm.' },
    { text: 'chùtkò', note: 'Quickly. Polish szybko.' },
    { text: 'mómë', note: 'We have. Polish mamy.' },
    { text: 'Kòscół', note: 'Church. Polish kościół: Kashubian writes ò for an o said with a w in front of it.' },
    { text: 'snôżô', note: 'Pretty. Polish would say ładna.' },
  ],
  szl: [
    { text: 'niy', note: 'Not. Polish nie, Czech ne.' },
    { text: 'Jŏ', note: 'I. Polish ja, Kashubian jô.' },
    { text: 'chlyb', note: 'Bread. Polish writes chleb.' },
    { text: 'piyknie', note: 'Beautifully. Polish pięknie.' },
    { text: 'prŏwda', note: 'Truth. Polish prawda: Silesian ŏ stands where Polish has a.' },
    { text: 'jedzōm', note: 'They eat. Polish jedzą: Silesian writes ōm where Polish has the nasal ą.' },
    { text: 'wyglōndŏsz', note: 'You look. Polish wyglądasz.' },
  ],
  yua: [
    { text: 'Tuláakal', note: 'All, everyone. Kaqchikel says konojel, Tzeltal spisil; the accent marks a high tone, which neither of them has.' },
    { text: 'máak', note: 'Person, someone. Kaqchikel says winäq, Tzeltal winik.' },
    { text: 'Mixmáak', note: 'Nobody. Kaqchikel says man jun winäq.' },
    { text: 'kʼanaʼan', note: 'Necessary. Kaqchikel says k\'atzinel, K\'iche\' rajawaxik.' },
    { text: 'jumpʼéel', note: 'One, counted with pʼéel, the classifier for things. Kaqchikel and K\'iche\' just say jun.' },
  ],
  quc: [
    { text: 'Rajawaxik', note: 'It is necessary. Kaqchikel says k\'atzinel.' },
    { text: 'xuqe', note: 'And, also. Kaqchikel says chuqa\'.' },
    { text: 'kakimulij', note: 'They gather. The ka- marks an ongoing action; Kaqchikel uses ni- instead, as in nikimöl.' },
    { text: 'Maj jun', note: 'No one. Kaqchikel says man jun, Q\'eqchi\' maani.' },
    { text: 'chech', note: 'To him or her. Kaqchikel says chi re.' },
    { text: 'k\'aslemal', note: 'Life. Kaqchikel says k\'aslen.' },
    { text: 'uwach', note: 'Its face, with the prefix u-; uwachulew, the world, is the face of the earth. Kaqchikel says ruwäch, with ru-.' },
  ],
  cak: [
    { text: 'winäq', note: 'Person, written with ä. K\'iche\' writes winaq, Tzeltal winik.' },
    { text: 'Man jun', note: 'No one. K\'iche\' says maj jun, Yucatec mixmáak.' },
    { text: 'chuqa\'', note: 'And, also. K\'iche\' says xuquje\', Mam b\'ix.' },
    { text: 'nikimöl', note: 'They gather, with ni- for an ongoing action. K\'iche\' never uses ni- for that; it says kakimulij.' },
    { text: 'ütz', note: 'Good. K\'iche\' writes utz, without the dots; Yucatec says maʼalob.' },
    { text: 'k\'atzinel', note: 'Necessary, must. K\'iche\' says rajawaxik, Yucatec kʼanaʼan.' },
  ],
  kek: [
    { text: 'Chijunil', note: 'All, everyone. K\'iche\' and Kaqchikel say konojel, Mam kyaqiil.' },
    { text: 'li poyanam', note: 'The person. Kaqchikel says ri winäq: Q\'eqchi\' has li where its neighbours have ri.' },
    { text: 'Maani', note: 'Nobody. K\'iche\' says maj jun, Kaqchikel man jun.' },
  ],
  mam: [
    { text: 'xjaal', note: 'Person. K\'iche\' says winaq, Kaqchikel winäq, Q\'eqchi\' poyanam.' },
    { text: 'Kyaqiil', note: 'All, everyone. K\'iche\' and Kaqchikel say konojel, Q\'eqchi\' chijunil.' },
    { text: 'b\'ix', note: 'And. K\'iche\' says xuquje\', Kaqchikel chuqa\', Q\'eqchi\' ut.' },
  ],
  tzh: [
    { text: 'Spisil', note: 'All. K\'iche\' and Kaqchikel say konojel, Yucatec tuláakal.' },
    { text: 'winiketik', note: 'People: winik with the plural -etik. K\'iche\' says winaq, Yucatec máak.' },
    { text: 'srerecho', note: 'His, her or their right: Spanish derecho with the Tzeltal possessive s- in front. K\'iche\' and Kaqchikel would put u- or ru- there.' },
  ],
  nav: [
    { text: 'Tʼáá', note: 'Just, exactly. Quechua writes a glottal tʼ too but has no tones; Navajo marks high tone on each half of a long vowel.' },
    { text: 'ajiłtsoh', note: 'Everyone. The ł is a voiceless l; Polish uses the same letter for a w sound.' },
    { text: 'hazʼą́', note: 'From the Navajo words for a right and a law. The ą́ is nasal and high in tone at once; Polish writes the hook but never an accent over it.' },
    { text: 'Ałchíní', note: 'Children. Polish also writes ł, but for a w sound; in Navajo it is a voiceless l.' },
  ],
  arn: [
    { text: 'mvley', note: 'There is. The v here is a vowel, written ü in other Mapudungun spellings; Spanish, Quechua and Aymara have no such vowel.' },
    { text: 'gelay', note: 'Not, built into the verb: Mapudungun negates with -la-, as in gelay, there is not. Quechua puts mana in front instead.' },
    { text: 'pu ce', note: 'People: pu makes a plural and ce is person. Quechua says runakuna, with the plural at the end.' },
  ],
  cab: [
    { text: 'gürigia', note: 'Person, people. Haitian Creole says moun, Spanish persona, and the ü here is a vowel of its own that neither has.' },
    { text: 'lúrudu', note: 'Law. Spanish, spoken all around Garifuna, says ley.' },
  ],

  // Russia and the Caucasus.
  tyv: [
    { text: 'бүрүзү', note: 'Every, placed after the noun: кижи бүрүзү, every person. Kyrgyz says ар бир адам, Altai кажы ла кижи.' },
    { text: 'эргелиг', note: 'Has the right. Kyrgyz says укуктуу in the same articles, Altai тап-эриктӱ.' },
    { text: 'ужурлуг', note: 'Must, with ж and a final г. Altai writes the same word учурлу, and Kyrgyz uses тийиш.' },
    { text: 'Кым-даа', note: 'No one, built on кым, who. Altai says кем де, Kyrgyz эч ким.' },
    { text: 'болгаш', note: 'And. Kyrgyz says жана, Altai ла, Khakas паза.' },
  ],
  alt: [
    { text: 'јарабас', note: 'Not allowed, written with ј. Khakas has the same word with ч: чарабас.' },
    { text: 'эмезе', note: 'Or. Tuvan says азы, Khakas алай, Kyrgyz же.' },
    { text: 'учурлу', note: 'Must. Tuvan writes the same word ужурлуг, with ж and a final г.' },
    { text: 'Оныҥ', note: 'His, ending in ҥ, the letter Altai uses for ng. Tuvan and Khakas write that sound as ң: ооң, аның.' },
    { text: 'Кажы ла', note: 'Every, in front of the noun: кажы ла кижи. Tuvan says кижи бүрүзү, Kyrgyz ар бир адам.' },
    { text: 'тапэриктӱ', note: 'Has the right, ending in ӱ where Tuvan and Kyrgyz write ү. Tuvan says эргелиг, Kyrgyz укуктуу.' },
  ],
  kjh: [
    { text: 'паза', note: 'And. Tuvan says болгаш, Altai ла, Kyrgyz жана.' },
    { text: 'поларға', note: 'To be, with п. Tuvan and Altai start the same verb with б: болур, болор.' },
    { text: 'Пірдее', note: 'No one, built on пір, one. Khakas writes п where Tuvan, Altai and Kyrgyz write б: бир.' },
    { text: 'чарадылбинча', note: 'Is not allowed. Altai writes the same verb with ј: јарадылбай.' },
    { text: 'кізі', note: 'Person, with з. Tuvan and Altai write кижи.' },
  ],
  mhr: [
    { text: 'огыл', note: 'Is not. Udmurt says ӧвӧл, Tatar түгел, Chuvash мар.' },
    { text: '-влак', note: 'The plural, joined on with a hyphen: ӱдыр-влак, girls. Udmurt adds -ос or -ёс to the noun itself.' },
    { text: 'йӧратем', note: 'I love. Tatar says яратам, Chuvash юрататӑп, Udmurt яратӥсько.' },
    { text: 'Теҥгече', note: 'Yesterday, spelled with ҥ, a letter Udmurt and Komi do not have. Udmurt says толон.' },
    { text: 'Тудо', note: 'He or she. Udmurt says со, Komi сійӧ.' },
  ],
  udm: [
    { text: 'ӥ', note: 'An i after a consonant that stays hard. Komi writes і for the same job; Mari and Russian have no such letter.' },
    { text: 'ӵ', note: 'A hard ch, with two dots. Komi spells the same sound тш; Mari and Russian have no such letter.' },
    { text: 'нунал', note: 'Day. Mari says кече, Komi лун.' },
    { text: 'яратӥсько', note: 'I love. Mari says йӧратем, Tatar яратам.' },
    { text: 'туж', note: 'Very. Komi says зэв, Tatar бик.' },
    { text: 'ӧвӧл', note: 'There is none. Erzya says арасть in the same sentence, Mari уке.' },
  ],
  kpv: [
    { text: 'керка', note: 'House. Udmurt says корка, Mari пӧрт.' },
    { text: 'Сылӧн', note: 'His or her, with the ending -лӧн. Udmurt says солэн.' },
    { text: 'зэв', note: 'Very. Udmurt says туж.' },
    { text: 'Сійӧ', note: 'He or she, spelled with і. Udmurt says со, Mari тудо.' },
    { text: 'менам', note: 'My. Udmurt says мынам, Mari мыйын.' },
    { text: 'тіянӧс', note: 'You, as the object, with і. Udmurt writes ӥ in the same place: тӥледыз.' },
    { text: 'Кӧні', note: 'Where. Udmurt says кытын, Mari кушто.' },
  ],
  myv: [
    { text: 'арась', note: 'Is not there. Udmurt says ӧвӧл; unlike Udmurt and Mari, Erzya adds no letters to the Russian alphabet.' },
    { text: 'арасть', note: 'Are not there, the plural of арась. Udmurt says ӧвӧл in the same sentence.' },
    { text: 'кудосо', note: 'At home, from кудо, house. Udmurt says корка, Komi керка.' },
    { text: 'марто', note: 'With, placed after the word. Mari says дене.' },
    { text: 'Косо', note: 'Where. Udmurt says кытын.' },
    { text: 'важоди', note: 'Works. Udmurt says ужа.' },
    { text: 'ули', note: 'There is: монь ули, I have. Mari says уло, Udmurt вань.' },
  ],
  xal: [
    { text: 'сән', note: 'Good. Mongolian writes сайн, and has no letter ә.' },
    { text: 'кергтә', note: 'Needed. Mongolian writes хэрэгтэй, with х where Kalmyk has к.' },
    { text: 'бәәнә', note: 'Is. Mongolian writes байна.' },
    { text: 'деер', note: 'On. Mongolian writes дээр.' },
    { text: 'йовһар', note: 'On foot. Mongolian says явган.' },
    { text: 'өдр', note: 'Day, with the second vowel dropped. Mongolian writes өдөр.' },
    { text: 'Эндр', note: 'Today. Mongolian says өнөөдөр.' },
  ],
  kbd: [
    { text: 'махуэ', note: 'Day. Adyghe writes мафэ, Chechen де.' },
    { text: 'Дыгъуасэ', note: 'Yesterday. Adyghe says тыгъуасэ, with т.' },
    { text: 'сыкъеджэфыркъым', note: 'I cannot read, negated with -къым. Adyghe negates with -эп instead.' },
    { text: 'дапщэ', note: 'How much. Adyghe says тхьапш.' },
    { text: 'сыхуейщ', note: 'I want. Adyghe says сшӏоигъу.' },
  ],
  ady: [
    { text: 'сэкӏо', note: 'I go. Kabardian spells the verb кӏуэ where Adyghe has кӏо: сокӏуэ.' },
    { text: 'макӏох', note: 'They go. Kabardian spells the verb кӏуэ, with уэ where Adyghe has о.' },
    { text: 'сшӏагъэп', note: 'I did not know, negated with -эп. Kabardian negates with -къым.' },
    { text: 'сыусыщтэп', note: 'I will not lie, with the future -щт and the negative -эп. Kabardian negates with -къым.' },
    { text: 'тиунэм', note: 'To our house, with ти, our. Kabardian writes ди, with д.' },
  ],
  ava: [
    { text: 'йиго', note: 'Is, for a woman or girl. Avar says вуго for a man and буго for a thing; Lezgian says я for all three.' },
    { text: 'вуго', note: 'Is, for a man. It changes with gender: йиго for a woman, буго for a thing. Lezgian has one form, я.' },
    { text: 'буго', note: 'Is, for a thing: вуго for a man, йиго for a woman. Lezgian says я whatever the gender.' },
    { text: 'цӏакъ', note: 'Very. Chechen says чӏогӏа, Lezgian пара.' },
    { text: 'Дица', note: 'I, the form used with a verb like buy. Lezgian says за, Chechen ас.' },
    { text: 'босула', note: 'Buys, with the present ending -ула. Lezgian ends the present in -зва.' },
  ],
  lez: [
    { text: 'Зун', note: 'I. Avar says дун, Chechen со.' },
    { text: 'лугьузва', note: 'Am saying, with the present ending -зва. Avar ends the present in -ула.' },
    { text: 'гузва', note: 'Give, in the present with -зва. Avar would end it in -ула.' },
    { text: 'Чун', note: 'We. Avar says ниж, Chechen тхо.' },
    { text: 'незва', note: 'Eat, in the present with -зва. Avar ends the present in -ула.' },
  ],
  krc: [
    { text: 'тюйюлдю', note: 'Is not. Kumyk says тюгюл, Tatar түгел, Kyrgyz эмес.' },
    { text: 'джашайса', note: 'You live. Kumyk writes яшайсан, Kyrgyz жашайсың.' },
    { text: 'Тюнене', note: 'Yesterday. Kumyk says тюнегюн, Tatar кичә.' },
    { text: 'кёрдюнгмю', note: 'Did you see, spelled with ё and ю. Kumyk starts the verb with г, and Kyrgyz writes көрдүңбү.' },
    { text: 'ашхы', note: 'Good. Kumyk and Tatar say яхшы.' },
    { text: 'керекди', note: 'Need, with the ending -ди. Kumyk says тарыкъ.' },
  ],
  kum: [
    { text: 'тюгюл', note: 'Not. Karachay-Balkar says тюйюл, Tatar түгел.' },
    { text: 'яшайсан', note: 'You live. Karachay-Balkar writes джашайса, Tatar яшисең.' },
    { text: 'Тюнегюн', note: 'Yesterday. Karachay-Balkar says тюнене, Kyrgyz кечээ.' },
    { text: 'гелдим', note: 'I came, with г. Karachay-Balkar and Kyrgyz write келдим.' },
    { text: 'ишлеймен', note: 'I work, ending in -мен. Karachay-Balkar drops the н: ишлейме.' },
    { text: 'тарыкъ', note: 'Need. Karachay-Balkar says керек, Tatar кирәк.' },
    { text: 'гёрдюнгмю', note: 'Did you see, with г. Karachay-Balkar writes кёрдюнгмю, Kyrgyz көрдүңбү.' },
  ],
};

/** Every marker for a language, or an empty array if it has none. */
export function markersFor(code) {
  return MARKERS[code] || [];
}

/** The markers actually present in one sentence, in the order they appear. */
export function markersIn(code, text) {
  if (!text) return [];
  return markersFor(code)
    .filter((marker) => text.includes(marker.text))
    .sort((a, b) => text.indexOf(a.text) - text.indexOf(b.text));
}
