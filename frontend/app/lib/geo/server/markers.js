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
    { text: 'ज़', note: 'A nukta dot under ज, kept in Perso-Arabic loans. Bhojpuri and Maithili write the same words without it.' },
    { text: 'चाय', note: 'Tea. Marathi चहा, Nepali चिया, Bhojpuri and Maithili चाह.' },
  ],
  mar: [
    { text: 'ळ', note: 'The retroflex ळ. Hindi does not have this letter at all.' },
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
    { text: 'ہ', note: 'Gol he, the round h. Arabic and Persian write ه. Urdu uses this one.' },
    { text: 'ے', note: 'Bari ye, the big open y at the end of a word. Arabic and Persian have no such letter.' },
    { text: 'تھی', note: 'Aspiration written with ھ, which Indo-Aryan needs and Arabic and Persian do not.' },
  ],
  snd: [
    { text: 'ڄ', note: 'An implosive j. Sindhi has four implosives and a 52 letter alphabet, the longest in this script.' },
    { text: 'ڪ', note: 'Sindhi writes k as ڪ where Urdu and Persian write ک.' },
    { text: 'ويندو', note: 'Will go. The future in -ندو.' },
  ],
  arb: [
    { text: 'إلى', note: 'To. Written with hamza under alif, an Arabic spelling convention Persian and Urdu drop.' },
    { text: 'هذا', note: 'This. Persian says این, Urdu یہ.' },
    { text: 'شربت', note: 'I drank, with the subject inside the verb. Note there is no پ, چ, ژ or گ anywhere: Arabic has no such letters, and their absence is the tell.' },
  ],
  pes: [
    { text: 'می‌', note: 'The present prefix mi-, joined to the verb with a zero width non joiner. Nothing else in this script does that.' },
    { text: 'امروز', note: 'Today. Arabic اليوم, Urdu آج.' },
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
    { text: 'ё', note: 'Russian yo. Ukrainian and Bulgarian have no ё, Serbian no such letter at all.' },
  ],
  ukr: [
    { text: 'Сьогодні', note: 'Today, with the soft sign inside the word. Russian Сегодня.' },
    { text: 'щодня', note: 'Daily in one word. Russian needs каждый день.' },
    { text: 'куди', note: 'Where to. Russian куда, and Ukrainian has no ы anywhere.' },
  ],
  bul: [
    { text: 'Тази', note: 'This, feminine. Bulgarian dropped noun cases, alone among the Slavic languages here.' },
    { text: 'беше', note: 'Was. Russian было, Serbian било.' },
    { text: 'Той', note: 'He. Russian Он, Serbian Он.' },
  ],
  srp: [
    { text: 'ј', note: 'Serbian Cyrillic borrowed j straight from Latin. Russian and Bulgarian have no such letter.' },
    { text: 'ћ', note: 'A soft ch, one of five letters Vuk added. Nothing else in Cyrillic here uses it.' },
    { text: 'сваки', note: 'Every. Russian каждый, Bulgarian всеки.' },
    { text: 'посао', note: 'Work, with the l turned to o at the end of a word.' },
  ],
  kaz: [
    { text: 'қ', note: 'A deep k. Kazakh adds nine letters to Russian Cyrillic for Turkic sounds.' },
    { text: 'ң', note: 'Ng. Mongolian Cyrillic does not have it.' },
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

  cmn: [{ text: '他', note: 'He. A sentence made only of characters, with no kana threaded through it, is Chinese rather than Japanese.' }, { text: '我', note: 'I. A Chinese sentence with no kana in it is Chinese.' }],
  jpn: [{ text: 'の', note: 'Hiragana. Kana between the kanji is what separates Japanese from Chinese at a glance.' }, { text: 'は', note: 'The topic particle, in kana. Kana threaded between the kanji is what separates Japanese from Chinese at a glance.' }],
  kor: [{ text: '는', note: 'Hangul, syllables built from letters in blocks. Nothing else looks like it.' }, { text: '다', note: 'Every plain sentence ends in this syllable. Korean has no Chinese characters in ordinary modern text.' }],
  // Latin, which is most of the pool and where the differences are
  // smallest. A shared alphabet means the tell is usually one letter
  // nobody else uses, or one word the neighbour spells differently.
  spa: [
    { text: 'ñ', note: 'Spanish enye. Portuguese writes the same sound nh, Catalan ny.' },
    { text: 'días', note: 'Days, with the accent. Portuguese writes dias without one.' },
    { text: 'adónde', note: 'Where to. Portuguese aonde, Catalan on.' },
    { text: 'lleva', note: 'The ll, which Portuguese writes lh and Catalan ll as well but rarely here.' },
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
    { text: 'î', note: 'A closed central vowel Romance languages do not otherwise have.' },
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
    { text: 'dronk', note: 'Drank. Afrikaans has dropped the strong past entirely and says het gedrink.' },
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
    { text: 'õ', note: 'A vowel Finnish does not have. This letter alone separates the two.' },
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
    { text: 'ł', note: 'A barred l, pronounced like w. No other language here has it.' },
    { text: 'ę', note: 'A nasal e with a hook. Polish and Lithuanian both use hooks, for different sounds.' },
    { text: 'Codziennie', note: 'Daily, in one word. Czech needs two, každý den, and spells the sounds with haceks rather than digraphs.' },
  ],
  ces: [
    { text: 'ě', note: 'E with a hacek, which softens the consonant before it. Polish writes that softness with i.' },
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
    { text: 'ë', note: 'A schwa written as e with two dots. Albanian is a branch of Indo-European with no close relatives.' },
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
    { text: 'đ', note: 'A barred d. Vietnamese only.' },
    { text: 'ờ', note: 'A vowel with a horn and a tone mark stacked on it. Two marks on one letter is the Vietnamese look.' },
    { text: 'ấy', note: 'That. Vietnamese words are almost all one syllable, so the text is a run of short pieces.' },
  ],
  ind: [
    { text: 'udaranya', note: 'The air. Indonesian and Malay are the same language in most sentences; the vocabulary is where they part.' },
    { text: 'dingin', note: 'Cold. Malay would say sejuk.' },
    { text: 'hangat', note: 'Warm, of a drink. Malay would say panas for the same cup of tea.' },
    { text: 'kantor', note: 'Office, from Dutch kantoor. Malay took pejabat instead.' },
  ],
  zsm: [
    { text: 'cuaca', note: 'The weather. Indonesian would more likely say udara here.' },
    { text: 'sejuk', note: 'Cool. Indonesian says dingin, and this pair is the clearest split between the two.' },
    { text: 'panas', note: 'Hot. Indonesian hangat for a drink.' },
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
    { text: 'ọ', note: 'An o with a dot under it, a different vowel from plain o.' },
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
    { text: 'emsebenzini', note: 'At work, with a prefix and a suffix wrapped round the stem.' },
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
