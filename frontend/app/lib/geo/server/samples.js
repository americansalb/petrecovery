/**
 * The sample sentences a script round shows.
 *
 * Server only, and that is a rule rather than a habit: if the browser
 * held the whole corpus it could match the text on screen against it and
 * read off the answer before the guess. The round endpoint sends one
 * sentence and a sealed token, the same way the panorama game sends a
 * panorama id and never the coordinate.
 *
 * **Provenance.** These sentences were written for the game. They are
 * not extracts from a corpus and they do not claim to be translations of
 * a common source text, because a parallel corpus is a better answer
 * than a hand-written one and this is a starting pool, not the finished
 * article. The two obvious upgrades, both open and both requiring a
 * network fetch this environment does not have, are the Universal
 * Declaration of Human Rights, which exists in more than five hundred
 * translations and is the canonical parallel text, and Tatoeba, which
 * has millions of sentences across four hundred languages tagged with
 * ISO 639-3 codes. Either drops straight into this shape.
 *
 * **The curation rule, which matters more than the size of the pool:**
 * strip proper nouns. A sentence containing a city name answers itself,
 * and so does a digit, a currency symbol or a flag. Nothing here names a
 * place, a person or a number, and __tests__/geo/script.test.js checks
 * that rather than trusting it.
 *
 * The sentences are deliberately ordinary and deliberately parallel in
 * content: cold morning, hot tea, walking to work. Same subject in every
 * language means the content cannot leak the answer, only the language
 * itself can, which is the whole point of the round.
 */

export const SAMPLES = {
  hin: [
    'आज सुबह बहुत ठंड थी, इसलिए मैंने गरम चाय पी।',
    'वह हर रोज़ पैदल ही दफ़्तर जाता है।',
    'मुझे नहीं पता कि यह रास्ता कहाँ जाता है।',
  ],
  mar: [
    'आज सकाळी खूप थंडी होती, म्हणून मी गरम चहा घेतला.',
    'तो दररोज चालत ऑफिसला जातो.',
    'मला माहीत नाही की हा रस्ता कुठे जातो.',
  ],
  npi: [
    'आज बिहान धेरै जाडो थियो, त्यसैले मैले तातो चिया खाएँ।',
    'उनी हरेक दिन हिँडेरै कार्यालय जान्छन्।',
    'मलाई थाहा छैन यो बाटो कहाँ जान्छ।',
  ],
  bho: [
    'आज भोरे बहुते जाड़ा रहे, ओहसे हम गरम चाह पिअनी।',
    'ऊ रोज पैदले दफ्तर जाला।',
  ],
  mai: [
    'आइ भोरमे बड़ ठंढ छल, तेँ हम गरम चाह पिलहुँ।',
    'ओ रोज पएरे कार्यालय जाइत छथि।',
  ],
  ben: [
    'আজ সকালে খুব ঠান্ডা ছিল, তাই আমি গরম চা খেয়েছি।',
    'সে প্রতিদিন হেঁটেই অফিসে যায়।',
    'আমি জানি না এই রাস্তা কোথায় যায়।',
  ],
  asm: [
    'আজি ৰাতিপুৱা বৰ ঠাণ্ডা আছিল, সেয়েহে মই গৰম চাহ খালোঁ।',
    'তেওঁ প্ৰতিদিনে খোজ কাঢ়িয়েই কাৰ্যালয়লৈ যায়।',
  ],
  pan: [
    'ਅੱਜ ਸਵੇਰੇ ਬਹੁਤ ਠੰਢ ਸੀ, ਇਸ ਲਈ ਮੈਂ ਗਰਮ ਚਾਹ ਪੀਤੀ।',
    'ਉਹ ਹਰ ਰੋਜ਼ ਪੈਦਲ ਹੀ ਦਫ਼ਤਰ ਜਾਂਦਾ ਹੈ।',
  ],
  guj: [
    'આજે સવારે ખૂબ ઠંડી હતી, તેથી મેં ગરમ ચા પીધી.',
    'તે દરરોજ ચાલીને જ ઓફિસ જાય છે.',
  ],
  ory: [
    'ଆଜି ସକାଳେ ବହୁତ ଥଣ୍ଡା ଥିଲା, ତେଣୁ ମୁଁ ଗରମ ଚା ପିଇଲି।',
    'ସେ ପ୍ରତିଦିନ ଚାଲି ଚାଲି ଅଫିସ ଯାଆନ୍ତି।',
  ],
  urd: [
    'آج صبح بہت سردی تھی، اس لیے میں نے گرم چائے پی۔',
    'وہ ہر روز پیدل ہی دفتر جاتا ہے۔',
  ],
  snd: [
    'اڄ صبح جو تمام سردي هئي، ان ڪري مون گرم چانهه پيتي.',
    'هو هر روز پيدل ئي آفيس ويندو آهي.',
  ],
  tam: [
    'இன்று காலை மிகவும் குளிராக இருந்தது, அதனால் நான் சூடான தேநீர் குடித்தேன்.',
    'அவர் தினமும் நடந்தே அலுவலகத்திற்குச் செல்கிறார்.',
  ],
  tel: [
    'ఈ రోజు ఉదయం చాలా చలిగా ఉంది, అందుకే నేను వేడి టీ తాగాను.',
    'అతను ప్రతిరోజూ నడిచే ఆఫీసుకు వెళ్తాడు.',
  ],
  kan: [
    'ಇಂದು ಬೆಳಿಗ್ಗೆ ತುಂಬಾ ಚಳಿ ಇತ್ತು, ಆದ್ದರಿಂದ ನಾನು ಬಿಸಿ ಚಹಾ ಕುಡಿದೆ.',
    'ಅವನು ಪ್ರತಿದಿನ ನಡೆದುಕೊಂಡೇ ಕಚೇರಿಗೆ ಹೋಗುತ್ತಾನೆ.',
  ],
  mal: [
    'ഇന്ന് രാവിലെ വളരെ തണുപ്പായിരുന്നു, അതുകൊണ്ട് ഞാൻ ചൂടുള്ള ചായ കുടിച്ചു.',
    'അവൻ എല്ലാ ദിവസവും നടന്നാണ് ഓഫീസിൽ പോകുന്നത്.',
  ],
  sin: [
    'අද උදේ හරිම සීතලයි, ඒ නිසා මම උණුසුම් තේ එකක් බිව්වා.',
    'ඔහු හැම දාම පයින්ම කාර්යාලයට යනවා.',
  ],
  arb: [
    'كان الجو باردا جدا هذا الصباح، لذلك شربت شايا ساخنا.',
    'يذهب إلى المكتب سيرا على الأقدام كل يوم.',
    'لا أعرف إلى أين يؤدي هذا الطريق.',
  ],
  pes: [
    'امروز صبح هوا خیلی سرد بود، برای همین چای داغ خوردم.',
    'او هر روز پیاده به دفتر می‌رود.',
  ],
  pbu: [
    'نن سهار ډېره یخني وه، نو ما ګرمه چای وڅښله.',
    'هغه هره ورځ پلی دفتر ته ځي.',
  ],
  ckb: [
    'ئەمڕۆ بەیانی زۆر سارد بوو، بۆیە چایەکی گەرمم خواردەوە.',
    'ئەو هەموو ڕۆژێک بە پێ دەچێتە نووسینگە.',
  ],
  uig: [
    'بۈگۈن ئەتىگەندە ھاۋا بەك سوغۇق ئىدى، شۇڭا مەن ئىسسىق چاي ئىچتىم.',
    'ئۇ ھەر كۈنى پىيادە ئىشخانىغا بارىدۇ.',
  ],
  rus: [
    'Сегодня утром было очень холодно, поэтому я выпил горячего чаю.',
    'Он каждый день ходит на работу пешком.',
    'Я не знаю, куда ведёт эта дорога.',
  ],
  ukr: [
    'Сьогодні вранці було дуже холодно, тому я випив гарячого чаю.',
    'Він щодня ходить на роботу пішки.',
    'Я не знаю, куди веде ця дорога.',
  ],
  bul: [
    'Тази сутрин беше много студено, затова изпих горещ чай.',
    'Той ходи на работа пеша всеки ден.',
  ],
  srp: [
    'Јутрос је било веома хладно, па сам попио врућ чај.',
    'Он сваки дан иде на посао пешке.',
  ],
  kaz: [
    'Бүгін таңертең өте суық болды, сондықтан мен ыстық шай іштім.',
    'Ол күн сайын жұмысқа жаяу барады.',
  ],
  mon: [
    'Өнөө өглөө маш хүйтэн байсан тул би халуун цай уусан.',
    'Тэр өдөр бүр ажилдаа явган явдаг.',
  ],
  ell: [
    'Σήμερα το πρωί έκανε πολύ κρύο, γι’ αυτό ήπια ζεστό τσάι.',
    'Πηγαίνει στη δουλειά με τα πόδια κάθε μέρα.',
  ],
  heb: [
    'היה קר מאוד הבוקר, ולכן שתיתי תה חם.',
    'הוא הולך למשרד ברגל כל יום.',
  ],
  kat: [
    'დღეს დილით ძალიან ცივოდა, ამიტომ ცხელი ჩაი დავლიე.',
    'ის ყოველდღე ფეხით მიდის სამსახურში.',
  ],
  hye: [
    'Այսօր առավոտյան շատ ցուրտ էր, դրա համար տաք թեյ խմեցի։',
    'Նա ամեն օր ոտքով է գնում աշխատանքի։',
  ],
  amh: [
    'ዛሬ ጠዋት በጣም ቀዝቃዛ ነበር፣ ስለዚህ ትኩስ ሻይ ጠጣሁ።',
    'እሱ በየቀኑ በእግሩ ወደ ቢሮ ይሄዳል።',
  ],
  tir: [
    'ሎሚ ንግሆ ኣዝዩ ቁሪ ነይሩ፣ ስለዚ ውዑይ ሻሂ ሰቲየ።',
    'ንሱ መዓልቲ መዓልቲ ብእግሩ ናብ ቤት ጽሕፈት ይኸይድ።',
  ],
  tha: [
    'เช้านี้อากาศหนาวมาก ฉันเลยดื่มชาร้อน',
    'เขาเดินไปทำงานทุกวัน',
  ],
  lao: [
    'ເຊົ້ານີ້ອາກາດໜາວຫຼາຍ ຂ້ອຍຈຶ່ງດື່ມຊາຮ້ອນ',
    'ຂ້ອຍຍ່າງໄປເຮັດວຽກທຸກມື້',
  ],
  khm: [
    'ព្រឹកនេះអាកាសធាតុត្រជាក់ណាស់ ដូច្នេះខ្ញុំបានផឹកតែក្តៅ។',
    'គាត់ដើរទៅធ្វើការរាល់ថ្ងៃ។',
  ],
  mya: [
    'ဒီမနက် အရမ်းအေးတယ်၊ ဒါကြောင့် ပူပူနွေးနွေး လက်ဖက်ရည် သောက်လိုက်တယ်။',
    'သူ နေ့တိုင်း ရုံးကို လမ်းလျှောက်သွားတယ်။',
  ],
  cmn: [
    '今天早上很冷，所以我喝了一杯热茶。',
    '他每天都走路去上班。',
    '我不知道这条路通向哪里。',
  ],
  jpn: [
    '今朝はとても寒かったので、温かいお茶を飲みました。',
    '彼は毎日歩いて会社に行きます。',
    'この道がどこへ続いているのか分かりません。',
  ],
  kor: [
    '오늘 아침은 무척 추워서 따뜻한 차를 마셨다.',
    '그는 매일 걸어서 회사에 간다.',
    '이 길이 어디로 이어지는지 모르겠다.',
  ],
  spa: [
    'Esta mañana hacía mucho frío, así que me tomé un té caliente.',
    'Va andando al trabajo todos los días.',
    'No sé adónde lleva este camino.',
  ],
  por: [
    'Esta manhã estava muito frio, por isso bebi um chá quente.',
    'Ele vai a pé para o trabalho todos os dias.',
    'Não sei aonde leva esta estrada.',
  ],
  ita: [
    'Stamattina faceva molto freddo, così ho bevuto un tè caldo.',
    'Va a piedi al lavoro tutti i giorni.',
  ],
  ron: [
    'În această dimineață a fost foarte frig, așa că am băut un ceai fierbinte.',
    'Merge pe jos la muncă în fiecare zi.',
  ],
  fra: [
    'Ce matin il faisait très froid, alors j’ai bu un thé chaud.',
    'Il va au bureau à pied tous les jours.',
    'Je ne sais pas où mène cette route.',
  ],
  cat: [
    'Aquest matí feia molt de fred, així que vaig prendre un te calent.',
    'Va a peu a la feina cada dia.',
  ],
  deu: [
    'Heute Morgen war es sehr kalt, deshalb habe ich einen heißen Tee getrunken.',
    'Er geht jeden Tag zu Fuß ins Büro.',
    'Ich weiß nicht, wohin dieser Weg führt.',
  ],
  nld: [
    'Vanochtend was het erg koud, dus dronk ik een warme thee.',
    'Hij gaat elke dag lopend naar kantoor.',
  ],
  afr: [
    'Vanoggend was dit baie koud, daarom het ek warm tee gedrink.',
    'Hy loop elke dag werk toe.',
  ],
  swe: [
    'I morse var det mycket kallt, så jag drack en kopp varmt te.',
    'Han går till jobbet varje dag.',
  ],
  dan: [
    'I morges var der meget koldt, så jeg drak en kop varm te.',
    'Han går på arbejde hver dag.',
  ],
  nob: [
    'I morges var det veldig kaldt, så jeg drakk en kopp varm te.',
    'Han går til jobben hver dag.',
  ],
  isl: [
    'Í morgun var mjög kalt, svo ég drakk heitt te.',
    'Hann gengur í vinnuna á hverjum degi.',
  ],
  fin: [
    'Tänä aamuna oli hyvin kylmä, joten join kuumaa teetä.',
    'Hän kävelee töihin joka päivä.',
  ],
  est: [
    'Täna hommikul oli väga külm, seetõttu jõin kuuma teed.',
    'Ta käib iga päev jalgsi tööl.',
  ],
  hun: [
    'Ma reggel nagyon hideg volt, ezért forró teát ittam.',
    'Minden nap gyalog megy dolgozni.',
  ],
  pol: [
    'Dziś rano było bardzo zimno, więc wypiłem gorącą herbatę.',
    'Codziennie chodzi do pracy pieszo.',
  ],
  ces: [
    'Dnes ráno byla velká zima, tak jsem si dal horký čaj.',
    'Chodí do práce pěšky každý den.',
  ],
  hrv: [
    'Jutros je bilo vrlo hladno, pa sam popio topli čaj.',
    'Svaki dan ide na posao pješice.',
  ],
  lit: [
    'Šįryt buvo labai šalta, todėl išgėriau karštos arbatos.',
    'Jis kasdien eina į darbą pėsčiomis.',
  ],
  sqi: [
    'Sot në mëngjes ishte shumë ftohtë, prandaj piva një çaj të nxehtë.',
    'Ai shkon në punë në këmbë çdo ditë.',
  ],
  eus: [
    'Gaur goizean oso hotz egiten zuen, beraz te bero bat hartu dut.',
    'Egunero oinez joaten da lanera.',
  ],
  cym: [
    'Roedd hi’n oer iawn y bore yma, felly yfais i de poeth.',
    'Mae’n cerdded i’r gwaith bob dydd.',
  ],
  tur: [
    'Bu sabah hava çok soğuktu, bu yüzden sıcak bir çay içtim.',
    'Her gün işe yürüyerek gidiyor.',
  ],
  azj: [
    'Bu səhər hava çox soyuq idi, ona görə isti çay içdim.',
    'O, hər gün işə piyada gedir.',
  ],
  uzn: [
    'Bugun ertalab juda sovuq edi, shuning uchun issiq choy ichdim.',
    'U har kuni ishga piyoda boradi.',
  ],
  vie: [
    'Sáng nay trời rất lạnh, nên tôi đã uống một tách trà nóng.',
    'Anh ấy đi bộ đến chỗ làm mỗi ngày.',
  ],
  ind: [
    'Pagi ini udaranya sangat dingin, jadi saya minum teh hangat.',
    'Dia berjalan kaki ke kantor setiap hari.',
  ],
  zsm: [
    'Pagi ini cuaca sangat sejuk, jadi saya minum teh panas.',
    'Dia berjalan kaki ke pejabat setiap hari.',
  ],
  tgl: [
    'Napakalamig ngayong umaga, kaya uminom ako ng mainit na tsaa.',
    'Naglalakad siya papunta sa trabaho araw-araw.',
  ],
  swh: [
    'Asubuhi ya leo kulikuwa na baridi sana, kwa hiyo nilikunywa chai ya moto.',
    'Yeye huenda kazini kwa miguu kila siku.',
  ],
  hau: [
    'Da safiyar yau an yi sanyi sosai, saboda haka na sha shayi mai zafi.',
    'Yana tafiya aiki da ƙafa kowace rana.',
  ],
  yor: [
    'Òwúrọ̀ òní tutù gan-an, nítorí náà mo mu tíì gbígbóná.',
    'Ó máa ń rìn lọ sí ibi iṣẹ́ lójoojúmọ́.',
  ],
  som: [
    'Subaxdan aad bay u qabow ahayd, sidaas darteed waxaan cabbay shaah kulul.',
    'Maalin walba lugta ayuu shaqada ku aadaa.',
  ],
  zul: [
    'Namhlanje ekuseni bekubanda kakhulu, ngakho ngiphuze itiye elishisayo.',
    'Uhamba ngezinyawo eya emsebenzini nsuku zonke.',
  ],
};

/** Every sample for a language, or an empty array if it has none. */
export function samplesFor(code) {
  return SAMPLES[code] || [];
}
