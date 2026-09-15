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
  mkd: [
    'Утрово беше многу студено, затоа испив топол чај.',
    'Тој секој ден оди на работа пешки.',
    'Не знам каде води овој пат.',
  ],
  bel: [
    'Сёння раніцай было вельмі холадна, таму я выпіў гарачай гарбаты.',
    'Ён кожны дзень ходзіць на працу пешшу.',
    'Я не ведаю, куды вядзе гэтая дарога.',
  ],
  tgk: [
    'Имрӯз субҳ ҳаво хеле хунук буд, барои ҳамин чойи гарм нӯшидам.',
    'Ӯ ҳар рӯз пиёда ба идора меравад.',
    'Намедонам, ки ин роҳ ба куҷо мебарад.',
  ],
  kir: [
    'Бүгүн эртең менен абдан суук болду, ошондуктан ысык чай ичтим.',
    'Ал күн сайын жумушка жөө барат.',
    'Бул жол кайда алып барарын билбейм.',
  ],
  slk: [
    'Dnes ráno bola veľká zima, tak som si dal horúci čaj.',
    'Chodí do práce pešo každý deň.',
    'Neviem, kam vedie táto cesta.',
  ],
  slv: [
    'Danes zjutraj je bilo zelo mrzlo, zato sem spil topel čaj.',
    'Vsak dan hodi v službo peš.',
    'Ne vem, kam pelje ta cesta.',
  ],
  lav: [
    'Šorīt bija ļoti auksts, tāpēc iedzēru karstu tēju.',
    'Viņš katru dienu iet uz darbu kājām.',
    'Es nezinu, kurp ved šis ceļš.',
  ],
  glg: [
    'Esta mañá facía moito frío, así que tomei un té quente.',
    'Vai andando ao traballo cada día.',
    'Non sei onde leva este camiño.',
  ],
  gle: [
    'Bhí sé an-fhuar ar maidin, mar sin d’ól mé tae te.',
    'Siúlann sé chun na hoibre gach lá.',
    'Cá dtéann an bóthar seo?',
  ],
  gla: [
    'Bha i glè fhuar sa mhadainn, mar sin dh’òl mi tì theth.',
    'Bidh e a’ coiseachd dhan obair a h-uile latha.',
    'Càite a bheil an rathad seo a’ dol?',
  ],
  mlt: [
    'Dalgħodu kien kiesaħ ħafna, għalhekk xrobt tè sħun.',
    'Kuljum jimxi għax-xogħol.',
    'Ma nafx fejn twassal din it-triq.',
  ],
  fao: [
    'Í morgun var sera kalt, so fekk eg mær heitt te.',
    'Hann gongur á arbeiði hvønn dag.',
    'Eg veit ikki, hvar hesin vegurin gongur.',
  ],
  ltz: [
    'De Moien war et ganz kal, dofir hunn ech waarmen Téi gedronk.',
    'Hie geet all Dag zu Fouss op de Büro.',
    'Ech weess net, wouhin dëse Wee féiert.',
  ],
  bre: [
    'Yen-tre e oa ar mintin-mañ, setu m’em eus evet te tomm.',
    'Bemdez ez a da labourat war-droad.',
    'N’ouzon ket pelec’h ez a an hent-mañ.',
  ],
  fry: [
    'Fanmoarn wie it hiel kâld, dêrom naam ik in bakje waarme tee.',
    'Alle dagen rint er nei it wurk.',
    'Ik wit net wêr’t dizze dyk hinne giet.',
  ],
  div: [
    'މިއަދު ހެނދުނު ވަރަށް ފިނި ވި، އެހެންވެ ހޫނު ސައި ބޮއެފިން.',
    'އޭނާ ކޮންމެ ދުވަހަކު ހިނގާފައި އޮފީހަށް ދެއެވެ.',
    'މި މަގު ކޮންތާކަށް ދާކަން އަހަންނަކަށް ނޭނގެ.',
  ],
  bod: [
    'དེ་རིང་ཞོགས་པར་གྲང་མོ་ཧ་ཅང་ཆེན་པོ་འདུག ངས་ཇ་ཚ་པོ་ཞིག་བཏུངས།',
    'ཁོང་ཉིན་ལྟར་རྐང་ཐང་གིས་ལས་ཁུངས་སུ་འགྲོ་གི་ཡོད།',
    'ལམ་འདི་ག་པར་འགྲོ་མིན་ངས་མི་ཤེས།',
  ],
  dzo: [
    'ད་རིས་དྲོ་པ་ཁ་ཤིན་ཏུ་གྲང་མོ་འདུག ཨིན་མི་ང་གིས་ཇ་ཚ་ཏོང་ཏོ་འཐུང་ཡི།',
    'ཁོ་ཉིནམ་བཞིན་དུ་རྐངམ་གིས་ལཱ་གཡོག་ནང་འགྱོཝ་ཨིན།',
    'ལམ་འདི་ག་ཏེ་འགྱོཝ་ཨིན་ན་ང་གིས་མི་ཤེས།',
  ],
  sat: [
    'ᱛᱮᱦᱮᱧ ᱥᱮᱛᱟᱜ ᱯᱩᱨᱟᱹ ᱨᱟᱵᱟᱝ ᱛᱟᱦᱮᱸᱠᱟᱱᱟ, ᱚᱱᱟᱛᱮ ᱤᱧ ᱨᱟᱹᱯᱩᱫ ᱪᱟᱭ ᱧᱩᱭ ᱠᱮᱫᱟ.',
    'ᱩᱱᱤ ᱫᱤᱱ ᱫᱤᱱ ᱛᱟᱞᱟᱛᱮ ᱠᱟᱹᱢᱤ ᱛᱮ ᱪᱟᱞᱟᱜ ᱠᱟᱱᱟ.',
    'ᱱᱚᱶᱟ ᱦᱚᱨ ᱚᱠᱟ ᱛᱮ ᱪᱟᱞᱟᱜ ᱠᱟᱱᱟ ᱤᱧ ᱵᱟᱝ ᱵᱟᱰᱟᱭᱟ.',
  ],
  mni: [
    'ꯉꯁꯤ ꯑꯌꯨꯛ ꯌꯥꯝꯅꯥ ꯏꯡꯏ, ꯃꯗꯨꯅꯥ ꯑꯩꯅꯥ ꯑꯁꯥꯕ ꯆꯥ ꯊꯛꯈꯤ.',
    'ꯃꯍꯥꯛꯅꯥ ꯅꯨꯃꯤꯠ ꯈꯨꯗꯤꯡꯒꯤ ꯈꯣꯡꯅꯥ ꯑꯣꯐꯤꯁ ꯆꯠꯂꯤ.',
    'ꯂꯝꯕꯤ ꯑꯁꯤ ꯀꯗꯥꯏꯗꯥ ꯆꯠꯂꯤꯕꯅꯣ ꯑꯩꯅꯥ ꯈꯉꯗꯦ.',
  ],
  chr: [
    'ᏑᎾᎴᎢ ᎤᏴᏢ ᎨᏎᎢ, ᎾᏍᎩ ᎢᏳᏍᏗ ᎤᏗᎴᎩ ᎠᏗᏔᏍᏗ ᎠᎩᏗᏔᏅᎩ.',
    'ᏂᏚᎩᏨᏂᏓᏒ ᏚᎳᏍᎬ ᎠᎢᏒ ᏗᎦᎸᏫᏍᏓᏁᏗ.',
    'ᎥᏝ ᏥᎦᏔᎲᎾ ᎯᎠ ᏂᎦᏅᏅ ᎭᏢ ᎠᎢᏒᎢ.',
  ],
  iku: [
    'ᐅᓪᓛᖅ ᓂᓪᓚᓱᒃᑐᖅ, ᑕᐃᒪᐃᒻᒪᑦ ᐅᖅᑰᑦᑐᒥᒃ ᑏᑐᖅᑐᖓ.',
    'ᐅᓪᓗᑕᒫᑦ ᐱᓱᒃᖢᓂ ᐃᖅᑲᓇᐃᔮᒧᑦ ᐱᓱᒃᑐᖅ.',
    'ᖃᐅᔨᒪᖏᑦᑐᖓ ᐊᖅᑯᑎ ᓇᒧᑦ ᐱᓯᒪᖕᒪᖔᑦ.',
  ],
  nqo: [
    'ߓߌ߬ ߛߐ߰ߡߊ߬ ߘߊ߬ ߛߎߡߦߊ ߞߊ߬ ߜߍߟߍ߲߫، ߒ ߞߊ߬ ߘߎ߬ߕߍ߬ ߜߏߟߏ߲߫ ߡߌ߲߬.',
    'ߊ߬ ߦߋ߫ ߕߊ߯ ߓߊ߯ߙߊ ߘߐ߫ ߛߋ߲߬ߠߊ߫ ߟߏ߲߫ ߏ߬ ߟߏ߲߫.',
    'ߒ ߡߊ߫ ߟߐ߲߫ ߛߌߟߊ ߣߌ߲߬ ߦߋ߫ ߕߊ߯ ߦߙߐ ߡߍ߲.',
  ],
  fuf: [
    '𞤖𞤢𞤲𞥋𞤣𞤫 𞤧𞤵𞤩𞤢𞤳𞤢 𞤶𞤢𞤲𞤺𞤵𞤣𞤫 𞤯𞤵𞥅𞤯𞤭, 𞤳𞤢𞤣𞤭 𞤥𞤭 𞤴𞤢𞤪𞤭 𞤷𞤢𞤴 𞤲𞤵𞤤𞥆𞤵𞤲𞤣𞤵.',
    '𞤳𞤢𞤲𞤳𞤮 𞤴𞤢𞤸𞤮 𞤴𞤢𞤸𞤢 𞤲𞤣𞤫𞤪 𞤺𞤮𞤤𞥆𞤫 𞤳𞤢 𞤳𞤵𞤴𞤣𞤫.',
    '𞤥𞤭 𞤢𞤲𞤣𞤢𞥄 𞤼𞤮 𞤤𞤢𞤱𞤮𞤤 𞤲𞤺𞤮𞤤 𞤴𞤢𞤸𞤢𞤼𞤢.',
  ],
  zgh: [
    'ⴰⵙⵙ ⴰⴷ ⵜⵉⴼⴰⵡⵜ ⵜⴳⴰ ⵜⴰⵙⵎⵎⵉⴹⵜ ⴱⴰⵀⵔⴰ, ⵖⵉⴽⴰⵏⵏ ⵙⵡⵉⵖ ⴰⵜⴰⵢ ⵉⵣⵖⴰⵏ.',
    'ⵏⵜⵜⴰ ⵉⵜⴷⴷⵓ ⵙ ⵓⴹⴰⵕ ⵖⵔ ⵜⵡⵡⵓⵔⵉ ⴽⵓ ⴰⵙⵙ.',
    'ⵓⵔ ⵙⵙⵉⵏⵖ ⵎⴰⵏⵉ ⵉⵜⴷⴷⵓ ⵡⴰⴱⵔⵉⴷ ⴰⴷ.',
  ],
  gom: [
    'आज सकाळीं खूब थंडी आसली, देखून हांवें गरम चा पियेलों.',
    'तो दर दिसा चलत ऑफिसाक वता.',
    'हो वाठ खंय वता तें म्हाका खबर ना.',
  ],
  doi: [
    'अज्ज सबेरे बड़ी ठंड ही, इस करी मैं गरम चाह पीती.',
    'ओह् हर रोज़ पैदल ई दफ्तर जंदा ऐ.',
    'मिगी नेईं पता जे एह् राह् कुत्थें जंदा ऐ.',
  ],
  awa: [
    'आजु भिनसार बहुत जाड़ रहा, तेहि से हम गरम चाह पियेन.',
    'ऊ रोजु पैदले दफ्तर जात ह.',
    'हमका नाहीं पता कि ई रस्ता कहाँ जात ह.',
  ],
  new: [
    'थौं सुथय् तःधंगु खाउ जुल, अथेहे जिं तातुगु चा त्वना.',
    'वय्कः सकल दिं तुं ल्हाना कार्यालयय् झाइ.',
    'थ्व लँ गन वनी जिं मसिउ.',
  ],
  pnb: [
    'اج سویرے بہوں ٹھنڈ سی، ایس لئی میں گرم چاہ پیتی۔',
    'اوہ ہر روز پیدل ای دفتر جاندا اے۔',
    'مینوں نئیں پتہ کہ ایہہ راہ کتھے جاندا اے۔',
  ],
  prs: [
    'امروز صبح هوا بسیار سرد بود، از همین خاطر چای گرم نوشیدم.',
    'او هر روز پیاده به دفتر میرود.',
    'نمیدانم که این سرک به کجا میرسد.',
  ],
  bal: [
    'مرۏچی صباحا پُر سرد اَت، گڈا من گرم چاہ وارتُن.',
    'آ ھر روچ پیادگ دفتر ءَ شت کنت.',
    'من نزانان کہ ای راہ کجا ءَ شت کنت.',
  ],
  kas: [
    'اَز صُبحَس ژھ ٹھنڈ آسِتھ، تہٕ مےۭ چٲو گرٕم چاے۔',
    'سُہ گژھہِ پرٛتھ دۄہ پیدل دفترَس۔',
    'مےۭ چھُنہٕ پتہ زِ یہٕ وَتھ کۄت گژھان۔',
  ],
  arz: [
    'الصبح النهارده كان برد قوي، عشان كده شربت شاي سخن.',
    'هو بيروح الشغل ماشي كل يوم.',
    'مش عارف الطريق ده بيودي فين.',
  ],
  ary: [
    'هاد الصباح كانت البرد بزاف، علاحقاش شربت أتاي سخون.',
    'كيمشي للخدمة على رجليه كل نهار.',
    'ما عرفتش فين كيمشي هاد الطريق.',
  ],
  tat: [
    'Бүген иртә бик салкын иде, шуңа күрә мин кайнар чәй эчтем.',
    'Ул һәр көн эшкә җәяү бара.',
    'Бу юл кая илтә, мин белмим.',
  ],
  bak: [
    'Бөгөн иртән бик һыуыҡ ине, шуға күрә мин ҡайнар сәй эстем.',
    'Ул һәр көн эшкә йәйәү бара.',
    'Был юл ҡайҙа алып бара, мин белмәйем.',
  ],
  chv: [
    'Паян ирхине питӗ сивӗччӗ, ҫавӑнпа эпӗ вӗри чей ӗҫрӗм.',
    'Вӑл кулленех ӗҫе ҫуран каять.',
    'Ку ҫул ӑҫта каять, эпӗ пӗлместӗп.',
  ],
  sah: [
    'Бүгүн сарсыарда олус тымныы этэ, онон итии чэйи испитим.',
    'Кини күн аайы үлэтигэр сатыы барар.',
    'Бу суол ханна барарын билбэппин.',
  ],
  oss: [
    'Абон райсом тынг уазал уыд, уымæ гæсгæ æз тæвд цай баназтон.',
    'Уый алы бон дæр куыстмæ фистæгæй цæуы.',
    'Æз нæ зонын, ацы фæндаг кæдæм цæуы.',
  ],
  che: [
    'Тахана Ӏуьйранна чӀогӀа шело яра, цундела ас мела чай мелира.',
    'Иза массо а де болхе гӀаш воьду.',
    'Суна ца хаьа хӀара некъ мичахьа боьду.',
  ],
  bos: [
    'Jutro je bilo veoma hladno, pa sam skuhao vruć čaj.',
    'On svakodnevno pješke odlazi na posao.',
    'Ne znam kuda vodi ovaj put.',
  ],
  oci: [
    'Aqueste matin fasiá plan freg, alara ai begut un te caud.',
    'Va a pè al trabalh cada jorn.',
    'Sabi pas ont mena aqueste camin.',
  ],
  srd: [
    'Custu manzanu fiat meda fritu, duncas apo bufadu unu te callenti.',
    'Andat a pee a traballare dontzi die.',
    'Non isco ue portat custu caminu.',
  ],
  ast: [
    'Esta mañana facía muncho fríu, asina que tomé un té caliente.',
    'Va andando al trabayu tolos díes.',
    'Nun sé au lleva esti camín.',
  ],
  roh: [
    'Quest damaun faschev fitg fraid, perquai hai jau bavì in te chaud.',
    'El va mintga di a pe al lavur.',
    'Jau na sai betg nua che quest via mena.',
  ],
  fur: [
    'Vuê a buinore al faseve une vore frêt, cussì o ai bevût un tè cjalt.',
    'Al va a pît al lavôr ogni dì.',
    'No sai dulà che al puarte chest troi.',
  ],
  sme: [
    'Odne iđđes lei hui galbmat, danne jugan liekkas deaja.',
    'Son vázzá beaivválaččat bargui.',
    'In dieđe gosa dát geaidnu manná.',
  ],
  hsb: [
    'Dźensa rano bě jara zyma, tuž sym horcy čaj pił.',
    'Wón dźe kóždy dźeń pěši do dźěła.',
    'Njewěm, hdźe tuta puć wjedźe.',
  ],
  ibo: [
    'Ụtụtụ taa oyi na-atụ nke ukwuu, ya mere aṅụrụ m tii ọkụ.',
    'Ọ na-aga ọrụ ije kwa ụbọchị.',
    'Amaghị m ebe okporo ụzọ a na-eje.',
  ],
  aka: [
    'Anɔpa yi awɔw wɔ hɔ paa, enti menom tii a ɛyɛ hyew.',
    'Ɔnantew kɔ adwuma da biara.',
    'Minnim baabi a saa kwan yi kɔ.',
  ],
  wol: [
    'Ci suba si liir na lool, moo tax ma naan attaaya bu tàng.',
    'Dafay dem liggéey ci tànk bés bu nekk.',
    'Xamuma fu yoon wii jëm.',
  ],
  kin: [
    'Uyu munsi mu gitondo hari imbeho nyinshi, ni yo mpamvu nanyoye icyayi gishyushye.',
    'Buri munsi ajya ku kazi n’amaguru.',
    'Sinzi aho uyu muhanda ujya.',
  ],
  nya: [
    'M’mawa muno kunali kuzizira kwambiri, choncho ndinamwa tiyi wotentha.',
    'Amapita kuntchito wapansi tsiku lililonse.',
    'Sindikudziwa kumene msewu uwu ukupita.',
  ],
  sna: [
    'Mangwanani ano kwaitonhora zvikuru, saka ndakanwa tii inopisa.',
    'Anofamba netsoka achienda kubasa zuva rega rega.',
    'Handizivi kwainoenda mugwagwa uyu.',
  ],
  xho: [
    'Kusasa bekubanda kakhulu kakhulu, ngoko ndisele iti eshushu.',
    'Uhamba ngeenyawo esiya emsebenzini yonke imihla.',
    'Andazi ukuba le ndlela iya phi.',
  ],
  sot: [
    'Hoseng ho ne ho bata haholo, kahoo ke ile ka noa tee e chesang.',
    'O tsamaya ka maoto ho ya mosebetsing letsatsi le leng le le leng.',
    'Ha ke tsebe hore na tsela ena e ya kae.',
  ],
  tsn: [
    'Mo mosong go ne go tsidifetse thata, ka jalo ke nwele tee e e mogote.',
    'O tsamaya ka dinao go ya tirong letsatsi le letsatsi.',
    'Ga ke itse gore tsela e e ya kae.',
  ],
  lug: [
    'Ku makya kuno kwali kunnyogoga nnyo, bwentyo nnanywa caayi ayokya.',
    'Atambula n’ebigere okugenda ku mulimu buli lunaku.',
    'Simanyi luwa oluguudo luno gye lugenda.',
  ],
  lin: [
    'Na ntɔngɔ ya lelo malili ezalaki mingi, yango wana namɛlaki tii ya mɔtɔ.',
    'Atambolaka na makolo mpo na kokende na mosala mokolo na mokolo.',
    'Nayebi te epai nzela oyo ekei.',
  ],
  bam: [
    'Bi sɔgɔma nɛnɛ tun ka bon kosɛbɛ, o de y’a to ne ye te kalaman min.',
    'A bɛ taa baara la senna don o don.',
    'Ne t’a dɔn sira in be taa yɔrɔ min na.',
  ],
  gaz: [
    'Har ganama bara akkaan qorree ture, kanaafuu shaayii hoʼaa dhuge.',
    'Guyyaa guyyaan miilaan hojiitti deema.',
    'Karaan kun eessa akka geessu hin beeku.',
  ],
  plt: [
    'Nangatsiaka be ny maraina, ka nisotro dite mafana aho.',
    'Mandeha an-tongotra mankany am-piasana isan’andro izy.',
    'Tsy fantatro izay alehan’ity lalana ity.',
  ],
  jav: [
    'Esuk iki hawane adhem banget, mula aku ngombe teh panas.',
    'Dheweke saben dina mlaku menyang kantor.',
    'Aku ora ngerti dalan iki menyang ngendi.',
  ],
  sun: [
    'Isuk ieu hawana tiris pisan, jadi kuring nginum entéh haneut.',
    'Manéhna unggal poé leumpang ka kantor.',
    'Kuring teu nyaho ieu jalan ka mana.',
  ],
  ceb: [
    'Bugnaw kaayo ganina buntag, mao nga nag-inom ko ug init nga tsa.',
    'Maglakaw siya padulong sa trabaho matag adlaw.',
    'Wala ko kahibalo asa padulong kini nga dalan.',
  ],
  ilo: [
    'Nalam-ek unay iti bigat, isu a nagin-inumak iti napudot a tsa.',
    'Magmagna a mapan agtrabaho iti inaldaw.',
    'Diak ammo no sadino ti papanan daytoy a dalan.',
  ],
  kmr: [
    'Vê sibehê pir sar bû, loma min çaya germ vexwar.',
    'Ew her roj bi peyatî diçe kar.',
    'Ez nizanim ev rê diçe ku derê.',
  ],
  tuk: [
    'Bu gün irden howa örän sowukdy, şonuň üçin men gyzgyn çaý içdim.',
    'Ol her gün işe pyýada gidýär.',
    'Bu ýoluň nirä barýanyny bilemok.',
  ],
  tet: [
    'Dadeer ohin malirin tebes, tan ne’e ha’u hemu xa manas.',
    'Nia la’o ba serbisu loron-loron.',
    'Ha’u la hatene dalan ne’e ba ne’ebé.',
  ],
  mri: [
    'He tino makariri te ata nei, nō reira i inu au i te tī wera.',
    'Ka hīkoi ia ki te mahi ia rā.',
    'Kāore au i te mōhio ki hea tēnei huarahi.',
  ],
  smo: [
    'Sa malulu tele le taeao nei, o lea na ou inu ai se lauti vevela.',
    'E savali o ia i le galuega i aso uma.',
    'Ou te le iloa po o fea e alu i ai lenei auala.',
  ],
  ton: [
    'Naʻe momoko ʻaupito ʻa e pongipongi ni, ko ia naʻá ku inu ai ha tī māfana.',
    'ʻOku ʻalu haʻele ia ki he ngāue ʻi he ʻaho kotoa.',
    'ʻOku ʻikai te u ʻilo pe ʻalu ki fē ʻa e hala ni.',
  ],
  fij: [
    'E batabata sara na mataka nikua, o koya au gunuva kina e dua na tī katakata.',
    'E taubale ina cakacaka e veisiga.',
    'Au sega ni kila se lako i vei na gaunisala oqo.',
  ],
  haw: [
    'Ua anu loa kēia kakahiaka, no laila ua inu au i ke kī wela.',
    'Hele wāwae ʻo ia i ka hana i kēlā me kēia lā.',
    'ʻAʻole au i ʻike i hea e hele ai kēia alanui.',
  ],
  tpi: [
    'Long moning nau em i kol tumas, olsem na mi dringim hot ti.',
    'Em i wokabaut i go long wok long olgeta de.',
    'Mi no save rot ia i go we.',
  ],
  que: [
    'Kunan paqarin anchata chirirqan, chayrayku qʼuñi tiyata upyarqani.',
    'Paymi sapa punchaw chakillawan llamkʼaq rin.',
    'Manam yachanichu maytataq kay ñan rin.',
  ],
  aym: [
    'Jichhüru alwaxa wali thayawa, ukatwa juntʼu tiy umtʼawayta.',
    'Jupax sapüru kayuki irnaqawiruw sari.',
    'Janiw yatkti kawksatï aka thakhix sarki.',
  ],
  grn: [
    'Ko pyhareve iporã roʼy, upévare haʼu peteĩ té hakúva.',
    'Haʼe oguata káda ára mbaʼapohápe.',
    'Ndaikuaái moõpa ohoha ko tape.',
  ],
  hat: [
    'Maten an te fè frèt anpil, se sa k fè m te bwè yon te cho.',
    'Li mache ale nan travay chak jou.',
    'Mwen pa konnen ki kote wout sa a mennen.',
  ],
  pap: [
    'E mainta aki tabata masha friu, p’esei mi a bebe un te kayente.',
    'E ta kana bai trabou tur dia.',
    'Mi no sa unda e kaminda aki ta bai.',
  ],
  kal: [
    'Ullaaq manna nillernarluinnarpoq, taamaattumik kissartumik teerpallaarpunga.',
    'Ullut tamaasa pisuttuarluni sulisarfimminut pisarpoq.',
    'Naluara aqqut una sumut ingerlasoq.',
  ],
  yue: [
    '今朝好凍，所以我飲咗杯熱茶。',
    '佢每日都行路返工。',
    '我唔知呢條路去邊度。',
  ],
};

/** Every sample for a language, or an empty array if it has none. */
export function samplesFor(code) {
  return SAMPLES[code] || [];
}
