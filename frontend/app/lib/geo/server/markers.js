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
 * Two rules, both checked by __tests__/geo/markers.test.js rather than
 * trusted:
 *
 * 1. **Every sample carries at least one marker**, so no round reveals
 *    with nothing to teach.
 * 2. **No marker appears in another language written in the same
 *    script.** A feature shared with the language you would confuse it
 *    with is not a marker, it is a red herring. Across scripts the
 *    check is pointless, because the script already answered it.
 *
 * Where a script belongs to one language in the pool the script is the
 * marker, and the reveal says so on its own: that is computed, not
 * written here.
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
    { text: 'बहुते', note: 'The emphatic -e ending stuck on an adverb.' },
  ],
  mai: [
    { text: 'छल', note: 'Was, built on छ like Nepali but inflected differently.' },
    { text: 'छथि', note: 'An honorific present. Maithili marks respect in the verb more finely than Hindi.' },
    { text: 'पिलहुँ', note: 'First person past in -हुँ.' },
    { text: 'जाइत', note: 'A participle in -इत where Hindi has -ता.' },
  ],

  // Bengali script, which is two answers and one letter apart.
  ben: [
    { text: 'র', note: 'Plain র. Assamese writes its r as ৰ, with a stroke through the middle, and that one letter separates the two.' },
    { text: 'আমি', note: 'I. Assamese says মই, which is the other half of the same tell.' },
    { text: 'খেয়েছি', note: 'A perfect in -ছি. Assamese ends the same tense in -লোঁ.' },
  ],
  asm: [
    { text: 'ৰ', note: 'Assamese ৰ, the r with a stroke. Bengali writes র. This is the quickest tell in the pool.' },
    { text: 'মই', note: 'I. Bengali says আমি, and the two languages differ more in the small words than the big ones.' },
    { text: 'তেওঁ', note: 'He or she, honorific, with a candrabindu Bengali does not use here.' },
    { text: 'লৈ', note: 'A postposition meaning towards. Bengali would use এ.' },
  ],

  pan: [
    { text: 'ੱ', note: 'The addak, which doubles the next consonant. Gurmukhi is written for one language in this pool.' },
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
    { text: 'ويندو', note: 'Will go. The future in -ندو.' },
  ],
  arb: [
    { text: 'إلى', note: 'To. Written with hamza under alif, an Arabic spelling convention Persian and Urdu drop.' },
    { text: 'هذا', note: 'This. Persian says این, Urdu یہ.' },
  ],
  pes: [
    { text: 'می‌', note: 'The present prefix mi-, joined to the verb with a zero width non joiner. Nothing else in this script does that.' },
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
    { text: 'ۈ', note: 'A front rounded vowel. Uyghur writes every vowel, so words look padded with circles.' },
  ],

  tam: [
    { text: 'குடித்தேன்', note: 'I drank, one word, with the person on the end. Tamil marks person in the verb; Malayalam has stopped doing it.' },
    { text: 'ற', note: 'Tamil uses one letter per place of articulation and no separate voiced series, so its alphabet is the shortest of the southern four.' },
  ],
  tel: [
    { text: 'ఉ', note: 'Telugu letters hang from a tick on the top left. Kannada is the closest shape and its tick sits differently.' },
    { text: 'ను', note: 'A first person ending in -ను.' },
  ],
  kan: [
    { text: 'ಿ', note: 'Kannada and Telugu are close cousins in shape; Kannada draws a fuller, rounder head on most letters.' },
    { text: 'ಾನೆ', note: 'A third person present in -ಾನೆ.' },
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
    { text: 'Тази', note: 'This, feminine. Bulgarian dropped noun cases, alone among the Slavic languages here.' },
    { text: 'всеки', note: 'Every. Macedonian секој, Serbian сваки, Russian каждый.' },
    { text: 'Той', note: 'He. Russian Он, Serbian Он.' },
  ],
  srp: [
    { text: 'ћ', note: 'A soft ch, one of five letters Vuk added. Nothing else in Cyrillic here uses it.' },
    { text: 'сваки', note: 'Every. Russian каждый, Bulgarian всеки.' },
    { text: 'посао', note: 'Work, with the l turned to o at the end of a word.' },
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

  ell: [{ text: 'Σ', note: 'Greek, and in this pool Greek is one answer.' }, { text: 'Πηγαίνει', note: 'Goes. Greek puts the verb first and needs no pronoun, because the ending already carries it.' }],
  heb: [{ text: 'ש', note: 'Hebrew, written right to left with no vowels marked.' }, { text: 'ה', note: 'The definite article is a single letter stuck to the front of the word.' }],
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
    { text: 'piedi', note: 'Feet. Almost every Italian word ends in a vowel, which is the quickest tell of all.' },
  ],
  ron: [
    { text: 'ă', note: 'A breve. Romanian is a Romance language with Slavic neighbours and its own vowels.' },
    { text: 'ș', note: 'S with a comma below, not a cedilla. Turkish writes ş, which is a different letter.' },
    { text: 'ț', note: 'T with a comma below. Nothing else in this pool uses it.' },
  ],
  fra: [
    { text: 'faisait', note: 'An imperfect with three vowels for one sound. French spells history, not pronunciation.' },
    { text: 'bureau', note: 'The -eau ending. No other Romance language here spells it that way.' },
    { text: 'où', note: 'Where. The only French word with a grave over u.' },
  ],
  cat: [
    { text: 'vaig', note: 'A past built with the verb to go: vaig prendre is I took. Spanish and French have nothing like it.' },
    { text: 'així', note: 'So. Spanish así, one letter shorter.' },
    { text: 'feina', note: 'Work. Spanish trabajo, French travail.' },
  ],
  deu: [
    { text: 'ß', note: 'The sharp s. Only German has it, and Switzerland does not.' },
    { text: 'getrunken', note: 'A past participle wrapped in ge- and -en, with the verb sent to the end.' },
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
    { text: 'mjög', note: 'Very. Icelandic kept the old words the mainland dropped.' },
    { text: 'gengur', note: 'Walks. Icelandic still inflects verbs for person, which the others gave up.' },
    { text: 'vinnuna', note: 'A noun in the accusative. Icelandic has four cases; Danish has none.' },
  ],
  fin: [
    { text: 'joten', note: 'So. Finnish is not Indo-European and shares almost no words with its neighbours.' },
    { text: 'kuumaa', note: 'Hot, in the partitive. Doubled vowels and doubled consonants are the Finnish look.' },
    { text: 'kävelee', note: 'Walks. Estonian would say kõnnib or käib.' },
    { text: 'päivä', note: 'Day. Estonian päev: Estonian has worn its endings down, Finnish has not.' },
  ],
  est: [
    { text: 'seetõttu', note: 'Therefore. Estonian and Finnish are close cousins, and this word exists in neither the other way round.' },
    { text: 'jalgsi', note: 'On foot. Finnish says jalan: the two are related, and Estonian has worn its endings shorter.' },
    { text: 'tööl', note: 'At work, marked by an ending rather than a preposition.' },
  ],
  hun: [
    { text: 'ezért', note: 'Therefore. Hungarian is related to Finnish and Estonian and to nothing around it.' },
    { text: 'forró', note: 'Hot. The long ó is written, and matters.' },
    { text: 'gyalog', note: 'On foot. The gy digraph is a Hungarian letter in its own right.' },
    { text: 'dolgozni', note: 'To work, an infinitive in -ni.' },
  ],
  pol: [
    { text: 'ę', note: 'A nasal e with a hook. Polish and Lithuanian both use hooks, for different sounds.' },
    { text: 'Codziennie', note: 'Daily, in one word. Czech needs two, každý den, and spells the sounds with haceks rather than digraphs.' },
  ],
  ces: [
    { text: 'jsem', note: 'I am. Czech clitics sit second in the sentence, wherever that falls.' },
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
    { text: 'pėsčiomis', note: 'On foot, in the instrumental plural. Lithuanian still has seven cases.' },
    { text: 'kasdien', note: 'Daily, in one word. Polish needs two: codziennie is built the same way but spelled nothing like it.' },
  ],
  sqi: [
    { text: 'prandaj', note: 'Therefore. Albanian shares its alphabet with Italian across the water and almost none of its words.' },
    { text: 'shkon', note: 'Goes. Albanian writes sh and ç, which look Italian, over a vocabulary that is not.' },
    { text: 'çdo', note: 'Every. Turkish also has ç, but Albanian pairs it with ë, which Turkish does not have.' },
  ],
  eus: [
    { text: 'zuen', note: 'An auxiliary that agrees with subject and object at once. Basque is related to nothing.' },
    { text: 'Egunero', note: 'Daily, built with an ending rather than a word for every.' },
    { text: 'oinez', note: 'On foot, marked by the ending -z.' },
    { text: 'lanera', note: 'To work. Basque stacks its cases on the end of the noun.' },
  ],
  cym: [
    { text: 'Roedd', note: 'Was. Welsh puts the verb first in the sentence.' },
    { text: 'felly', note: 'So. Welsh doubles l and f to make different sounds, so short words look longer than they sound.' },
    { text: 'cerdded', note: 'To walk. The dd is one letter in Welsh and sounds like th in this.' },
    { text: 'gwaith', note: 'Work. Welsh uses w as a vowel, which no other language here does.' },
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
    { text: 'ờ', note: 'A vowel with a horn and a tone mark stacked on it. Two marks on one letter is the Vietnamese look.' },
    { text: 'ấy', note: 'That. Vietnamese words are almost all one syllable, so the text is a run of short pieces.' },
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
    { text: 'Napakalamig', note: 'Very cold, in one word: Tagalog builds meaning with prefixes.' },
    { text: 'ngayong', note: 'The ng digraph, which can start a word.' },
    { text: 'Naglalakad', note: 'Is walking. The repeated syllable marks the aspect.' },
    { text: 'araw-araw', note: 'Every day, said by repeating the word for day.' },
  ],
  swh: [
    { text: 'nilikunywa', note: 'I drank: subject, tense and verb in one word, in that order.' },
    { text: 'kulikuwa', note: 'There was, with the place class marking the verb. Swahili agrees the whole sentence with the noun class.' },
    { text: 'kazini', note: 'At work, with the place marked by -ni on the end.' },
    { text: 'Yeye', note: 'He or she. Swahili has no grammatical gender.' },
  ],
  hau: [
    { text: 'ƙ', note: 'A hooked k, pronounced with the throat closed. Hausa writes four such letters.' },
    { text: 'saboda', note: 'Because, from Arabic. Hausa took its abstract words from Arabic and kept its own sounds.' },
    { text: 'shayi', note: 'Tea, from Arabic shai, as in most languages that got it overland rather than by sea.' },
    { text: 'kowace', note: 'Every, agreeing in gender. Hausa has two genders where Swahili has a dozen noun classes.' },
  ],
  yor: [
    { text: 'ṣ', note: 'An s with a dot under it, pronounced sh.' },
    { text: 'ẹ', note: 'An e with a dot under it. Dots below for vowel quality and accents above for tone: two systems at once.' },
    { text: 'gan-an', note: 'Very. Yoruba writes a hyphen where a syllable repeats, which no other language here does.' },
  ],
  som: [
    { text: 'waxaan', note: 'A focus marker Somali puts before the thing being asserted.' },
    { text: 'sidaas', note: 'So. Somali doubles vowels to mark length, which is why words look longer than they sound.' },
    { text: 'ayuu', note: 'Another focus marker, fused with the subject.' },
    { text: 'shaqada', note: 'The work, definite in -da. Somali also writes x and c for two throat sounds.' },
  ],
  zul: [
    { text: 'Namhlanje', note: 'Today. The hl is one sound, made at the side of the tongue.' },
    { text: 'ngiphuze', note: 'I drank: the subject is a prefix, not a separate word.' },
    { text: 'ngezinyawo', note: 'By foot. Zulu nouns carry a class prefix that the rest of the sentence agrees with.' },
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
    { text: 'билбейм', note: 'I do not know, negated inside the verb.' },
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
    { text: 'dtéann', note: 'Goes, with eclipsis: the d is written in front and the t goes silent.' },
    { text: 'Siúlann', note: 'Walks. Irish puts the verb first, and this ending is one Scottish Gaelic does not have.' },
    { text: 'hoibre', note: 'Of the work, with an h inserted after the article.' },
  ],
  gla: [
    { text: 'glè', note: 'Very, with a grave accent. Irish writes every long vowel with an acute instead.' },
    { text: 'Càite', note: 'Where. Irish writes cá, and the grave accent here is the giveaway.' },
    { text: 'coiseachd', note: 'Walking. Irish siúl: the two languages split in the middle ages and kept different words for it.' },
    { text: 'theth', note: 'Hot, lenited. Irish te.' },
  ],
  mlt: [
    { text: 'għ', note: 'A silent digraph that lengthens the vowel beside it. Maltese only, and it is Arabic ain written in Latin letters.' },
    { text: 'ħ', note: 'A barred h. Maltese is a Semitic language written in the Latin alphabet, which no other language here is.' },
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
    { text: 'bakje', note: 'A cup, literally a little tray.' },
    { text: 'dyk', note: 'Road, and also dyke. Dutch dijk, English dyke: Frisian is the closest living language to English.' },
    { text: 'wêr', note: 'Where. Dutch waar, with a circumflex Dutch does not use.' },
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
    { text: 'བཏུངས', note: 'Drank. Tibetan spelling keeps consonants that stopped being pronounced a thousand years ago, which is why the stacks are so tall.' },
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
    { text: 'ꯅꯨꯃꯤꯠ', note: 'Day. Every letter in this alphabet is named after a part of the body.' },
  ],
  chr: [
    { text: 'ᎥᏝ', note: 'Not. Sequoyah built this syllabary around 1820 without being able to read any other writing, which had never been done before or since.' },
    { text: 'ᎠᎩᏗᏔᏅᎩ', note: 'I drank it. One Cherokee word carries what English needs three for.' },
    { text: 'ᏂᏚᎩᏨᏂᏓᏒ', note: 'Every day. Some characters look like Latin letters and none of them sound like one: Ꮎ is na, Ꭶ is ga.' },
  ],
  iku: [
    { text: 'ᖅ', note: 'A final q. The small raised characters are consonants with no vowel after them.' },
    { text: 'ᐅᓪᓗᑕᒫᑦ', note: 'Every day. These syllabics were adapted from a shorthand a missionary designed for Cree.' },
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
    { text: '𞤢', note: 'The commonest vowel. The alphabet is under fifty years old and is now in Unicode and on phones.' },
  ],
  zgh: [
    { text: 'ⴰⵙⵙ', note: 'Day. Tifinagh is descended from the alphabet the Numidians used two thousand years ago, and was made official in Morocco in 2011.' },
    { text: 'ⵓⵔ', note: 'Not. Tamazight is also written in Latin and Arabic letters, and Tifinagh is the one that is nobody else’s.' },
    { text: 'ⵜ', note: 'T. Berber words very often begin and end with it, which is why this letter is everywhere.' },
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
    { text: 'میرود', note: 'Goes. Iran writes the same word with a zero width non joiner inside it, می\u200Cرود, and Afghanistan does not.' },
  ],
  bal: [
    { text: 'ۏ', note: 'A vowel written with a small v, for Balochi only.' },
    { text: 'کنت', note: 'Does. Balochi puts an auxiliary on the end where Persian does not.' },
    { text: 'وارتُن', note: 'I ate or drank. Balochi and Persian are both Iranian and split long before either was written.' },
  ],
  kas: [
    { text: 'ٲ', note: 'A vowel written with a wavy line over the alif. Kashmiri needs more vowel marks than any other language in this script and writes them all.' },
    { text: 'ۄ', note: 'Another Kashmiri vowel, a small v under the letter.' },
    { text: 'گژھ', note: 'To go. Kashmiri is Dardic, not Indo-Aryan, and the verbs show it.' },
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
    { text: 'фæндаг', note: 'Road. Ossetian is Iranian, the last of the Scythian languages, spoken in the middle of the Caucasus.' },
    { text: 'куыстмæ', note: 'To work, with the case marked on the end.' },
  ],
  che: [
    { text: 'Ӏ', note: 'The palochka, a stick borrowed from the Latin capital I to mark a sound made in the throat. Several Caucasian languages use it and none of the Slavic ones do.' },
    { text: 'воьду', note: 'Goes. The v at the front agrees with the gender of the subject, and Chechen has six genders.' },
    { text: 'хаьа', note: 'Knows. Chechen writes its many vowels with a following soft sign, so ь turns up everywhere.' },
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
    { text: 'ụ', note: 'A u with a dot under it, a different vowel from plain u. Igbo marks vowel harmony with the dots.' },
    { text: 'na-aga', note: 'Is going. Igbo writes its tense markers with a hyphen onto the verb.' },
    { text: 'Amaghị', note: 'Do not know. Yoruba marks tone with accents; Igbo mostly leaves tone unwritten and marks vowels instead.' },
    { text: 'ọkụ', note: 'Hot, with dots under both vowels. Yoruba puts its dots under o, e and s instead.' },
  ],
  aka: [
    { text: 'Anɔpa', note: 'Morning. Akan writes open o and open e as ɔ and ɛ, taken from the phonetic alphabet.' },
    { text: 'awɔw', note: 'Cold. Akan is tonal and does not write the tones, unlike Yoruba next door.' },
    { text: 'adwuma', note: 'Work. The dw is one sound, made at the back of the mouth.' },
    { text: 'Minnim', note: 'I do not know, negated by doubling the n.' },
  ],
  wol: [
    { text: 'lool', note: 'Very. Wolof doubles vowels for length, which is why the words look like that.' },
    { text: 'tànk', note: 'Foot, with a grave accent marking an open vowel.' },
    { text: 'Xamuma', note: 'I do not know. Wolof writes x for a sound made in the throat, as Somali does.' },
    { text: 'attaaya', note: 'Tea, from Arabic, and the whole ceremony with it.' },
  ],
  kin: [
    { text: 'icyayi', note: 'Tea. Kinyarwanda puts a class prefix on every noun, and here it is i- plus cy-.' },
    { text: 'Buri munsi', note: 'Every day. Kirundi, its near twin across the border, writes the same words.' },
    { text: 'amaguru', note: 'Legs, in the plural class ama-.' },
    { text: 'Sinzi', note: 'I do not know, negated with a prefix.' },
  ],
  nya: [
    { text: 'kwambiri', note: 'Very much. Shona zvikuru, and the two are neighbours that share little vocabulary.' },
    { text: 'ndinamwa', note: 'I drank: subject, tense and verb in one word, as in Swahili and with different pieces.' },
    { text: 'kuntchito', note: 'To work. Chichewa writes tch where Shona writes ch.' },
    { text: 'msewu', note: 'Road. Shona mugwagwa, Swahili barabara.' },
    { text: 'Sindikudziwa', note: 'I do not know. Chichewa negates with si- on the front.' },
  ],
  sna: [
    { text: 'Mangwanani', note: 'Morning. Chichewa m’mawa, Zulu ekuseni.' },
    { text: 'ndakanwa', note: 'I drank. Shona writes whole sentences as single words more than most Bantu languages.' },
    { text: 'netsoka', note: 'With the feet. Shona writes sv, zv and tsv, clusters no other Bantu language here uses.' },
    { text: 'mugwagwa', note: 'Road. Chichewa msewu, Swahili barabara.' },
    { text: 'Handizivi', note: 'I do not know. Shona negates with ha- on the front.' },
  ],
  xho: [
    { text: 'ndisele', note: 'I drank. Zulu would write ngiphuze: the two are close enough to understand each other and use different verbs here.' },
    { text: 'Andazi', note: 'I do not know. Zulu angazi.' },
    { text: 'ngeenyawo', note: 'By foot. Zulu ngezinyawo, and the doubled vowel is a Xhosa spelling Zulu does not use.' },
    { text: 'ndlela', note: 'Road. Xhosa writes three click letters, c, q and x, which is the fastest tell of all when one turns up.' },
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
    { text: 'kunnyogoga', note: 'To be cold. Luganda doubles consonants to mark length and it changes the meaning.' },
    { text: 'nnanywa', note: 'I drank. Luganda doubles the n at the front, which marks the person and the length at once.' },
    { text: 'ebigere', note: 'Feet, in the bi- class. Luganda agrees the whole sentence with the class of the noun.' },
    { text: 'oluguudo', note: 'Road, in the lu- class.' },
    { text: 'Simanyi', note: 'I do not know. Swahili sijui: the si- is the same negative in both.' },
  ],
  lin: [
    { text: 'ntɔngɔ', note: 'Morning. Lingala uses open o and open e, as the West African languages do, and is Bantu like Swahili.' },
    { text: 'namɛlaki', note: 'I drank. Swahili nilikunywa, and the pieces are in the same order in a different language.' },
    { text: 'Atambolaka', note: 'Walks, habitually: the -aka marks a thing done over and over.' },
    { text: 'nzela', note: 'Road. Swahili njia, and Lingala fronts more of its consonants with n.' },
    { text: 'Nayebi', note: 'I know. Lingala negates by adding te at the end rather than a prefix, which no other Bantu language here does.' },
  ],
  bam: [
    { text: 'sɔgɔma', note: 'Morning. This is the same language N’Ko was invented for, written in Latin letters instead.' },
    { text: 'kosɛbɛ', note: 'Very much. Bambara is Mande, so it has tone and no noun classes at all.' },
    { text: 'sira', note: 'Road. The same word N’Ko writes as ߛߌߟߊ, in Latin letters.' },
    { text: 'baara', note: 'Work. Bambara is Mande, not Bantu, and has no noun classes at all.' },
  ],
  gaz: [
    { text: 'ganama', note: 'Morning. Oromo is Cushitic and was written in Ethiopic until 1991, when it moved to Latin letters.' },
    { text: 'qorree', note: 'Cold. Oromo doubles both vowels and consonants for length.' },
    { text: 'miilaan', note: 'On foot. Oromo doubles the vowel for length, which changes the word if you do not.' },
    { text: 'Karaan', note: 'Road. Amharic, its neighbour, writes the same country in a different alphabet.' },
  ],
  plt: [
    { text: 'Nangatsiaka', note: 'Was cold. Malagasy is Austronesian: its closest relatives are in Borneo, four thousand miles away.' },
    { text: 'nisotro', note: 'Drank. The ni- marks the past.' },
    { text: 'an-tongotra', note: 'On foot. Malagasy hyphenates its prepositions onto the noun.' },
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
    { text: 'bilemok', note: 'I do not know, negated with -ok on the end.' },
    { text: 'sowukdy', note: 'Was cold. Turkish soğuktu, and Turkmen writes the same word without the soft g.' },
  ],
  tet: [
    { text: 'ha’u', note: 'I. Tetum writes a glottal stop with an apostrophe, and it is a letter.' },
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
    { text: 'ngāue', note: 'Work. Tongan is the only Polynesian language here that still has a definite accent as well as a macron.' },
  ],
  fij: [
    { text: 'batabata', note: 'Cold, said twice. Fijian doubles a word to soften it.' },
    { text: 'gaunisala', note: 'Road. Fijian writes b, d, q and g for sounds spelled mb, nd, ngg and ng elsewhere, which is why the words look unpronounceable and are not.' },
    { text: 'taubale', note: 'Walks. Fijian is Oceanic like the Polynesian languages and is not one of them.' },
    { text: 'nikua', note: 'Today. Samoan aso nei, Tongan ʻaho ni.' },
  ],
  haw: [
    { text: 'kakahiaka', note: 'Morning. Hawaiian has eight consonants, the fewest of any language here, so words are long and mostly vowels.' },
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
    { text: 'yachanichu', note: 'I do not know, with the question and the negative both marked by endings.' },
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
    { text: 'Ndaikuaái', note: 'I do not know, with the negative wrapped round the verb as nd- and -i.' },
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
    { text: 'Naluara', note: 'I do not know it. Greenlandic puts the object inside the verb.' },
    { text: 'aqqut', note: 'Road. Greenlandic doubles consonants constantly, which is what makes the words look like that.' },
    { text: 'Ullaaq', note: 'Morning. Inuktitut writes the same language family in syllabics instead.' },
  ],
  yue: [
    { text: '唔', note: 'Not. Mandarin writes 不, and this character is the single fastest way to tell written Cantonese from written Chinese.' },
    { text: '佢', note: 'He or she. Mandarin 他, and this character is Cantonese and almost nothing else.' },
    { text: '咗', note: 'A completed action. Mandarin 了.' },
    { text: '邊度', note: 'Where. Mandarin 哪里, and these characters exist for Cantonese and almost nothing else.' },
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
