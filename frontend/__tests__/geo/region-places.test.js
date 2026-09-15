/**
 * Every language is pinned to a place it is actually used.
 *
 * The regions are the part of this mode that can be quietly wrong. A
 * wrong subdivision code still resolves, a clip box drawn in the wrong
 * place still produces a polygon, and both score a round against
 * somewhere the language is not. Nothing in the corpus notices.
 *
 * So every language names at least one place where a person would
 * really encounter it: on a sign, in a newspaper, in a shop. Used,
 * rather than natively spoken, because that is the question the round
 * asks: you are shown a sentence and asked where you would find it.
 * Irish is the whole of Ireland by that measure, Tamazight the whole of
 * Morocco, Cherokee the reservation it is signposted across.
 *
 * A language with no place here fails the suite, so the corpus cannot
 * grow without someone saying where the new row belongs.
 */

const { LANGUAGES } = require('@/app/lib/geo/languages');
const { languagesAt, scoreScriptGuess } = require('@/app/lib/geo/server/regions');

// [lat, lng, what it is]. Cities, mostly: a place with a name is a
// place someone can check.
const PLACES = {
  hin: [[26.85, 80.95, 'Lucknow'], [28.61, 77.21, 'Delhi']],
  mar: [[19.08, 72.88, 'Mumbai'], [18.52, 73.86, 'Pune']],
  npi: [[27.72, 85.32, 'Kathmandu'], [28.21, 83.99, 'Pokhara']],
  bho: [[25.32, 82.97, 'Varanasi'], [26.76, 83.37, 'Gorakhpur']],
  mai: [[26.17, 85.9, 'Darbhanga']],
  ben: [[22.57, 88.36, 'Kolkata'], [23.81, 90.41, 'Dhaka']],
  asm: [[26.14, 91.74, 'Guwahati']],
  pan: [[30.9, 75.86, 'Ludhiana'], [31.63, 74.87, 'Amritsar']],
  guj: [[23.03, 72.58, 'Ahmedabad'], [21.17, 72.83, 'Surat']],
  ory: [[20.3, 85.82, 'Bhubaneswar']],
  urd: [[31.55, 74.34, 'Lahore'], [17.38, 78.49, 'Hyderabad']],
  snd: [[25.4, 68.37, 'Hyderabad, Sindh'], [24.86, 67.01, 'Karachi']],
  tam: [[13.08, 80.27, 'Chennai'], [9.66, 80.02, 'Jaffna']],
  tel: [[17.38, 78.49, 'Hyderabad'], [16.51, 80.63, 'Vijayawada']],
  kan: [[12.97, 77.59, 'Bengaluru'], [15.35, 75.14, 'Hubli']],
  mal: [[9.93, 76.27, 'Kochi'], [8.52, 76.94, 'Thiruvananthapuram']],
  sin: [[6.93, 79.86, 'Colombo'], [7.29, 80.64, 'Kandy']],
  arb: [[30.04, 31.24, 'Cairo'], [24.71, 46.68, 'Riyadh']],
  pes: [[35.69, 51.39, 'Tehran'], [32.65, 51.67, 'Isfahan']],
  pbu: [[34.01, 71.58, 'Peshawar'], [31.62, 65.72, 'Kandahar']],
  ckb: [[36.19, 44.01, 'Erbil'], [35.56, 45.43, 'Sulaymaniyah'], [35.31, 46.99, 'Sanandaj']],
  uig: [[43.83, 87.62, 'Urumqi'], [39.47, 75.99, 'Kashgar']],
  rus: [[55.76, 37.62, 'Moscow'], [56.84, 60.65, 'Yekaterinburg']],
  ukr: [[50.45, 30.52, 'Kyiv'], [49.84, 24.03, 'Lviv']],
  bul: [[42.7, 23.32, 'Sofia'], [42.15, 24.75, 'Plovdiv']],
  srp: [[44.79, 20.45, 'Belgrade'], [46.1, 19.67, 'Subotica']],
  kaz: [[43.24, 76.89, 'Almaty'], [51.17, 71.45, 'Astana']],
  mon: [[47.89, 106.91, 'Ulaanbaatar'], [40.81, 111.65, 'Hohhot']],
  ell: [[37.98, 23.73, 'Athens'], [40.64, 22.94, 'Thessaloniki']],
  heb: [[31.78, 35.22, 'Jerusalem'], [32.08, 34.78, 'Tel Aviv']],
  kat: [[41.72, 44.79, 'Tbilisi'], [42.15, 42.7, 'Kutaisi']],
  hye: [[40.18, 44.51, 'Yerevan'], [40.79, 43.85, 'Gyumri']],
  amh: [[9.03, 38.74, 'Addis Ababa'], [11.6, 37.39, 'Bahir Dar']],
  tir: [[13.5, 39.47, 'Mekelle'], [15.34, 38.93, 'Asmara']],
  tha: [[13.76, 100.5, 'Bangkok'], [18.79, 98.99, 'Chiang Mai']],
  lao: [[17.97, 102.6, 'Vientiane'], [19.89, 102.14, 'Luang Prabang']],
  khm: [[11.56, 104.92, 'Phnom Penh'], [13.36, 103.86, 'Siem Reap']],
  mya: [[16.87, 96.2, 'Yangon'], [21.95, 96.09, 'Mandalay']],
  cmn: [[39.9, 116.4, 'Beijing'], [31.23, 121.47, 'Shanghai']],
  jpn: [[35.68, 139.77, 'Tokyo'], [34.69, 135.5, 'Osaka']],
  kor: [[37.57, 126.98, 'Seoul'], [35.18, 129.08, 'Busan']],
  spa: [[40.42, -3.7, 'Madrid'], [-34.6, -58.38, 'Buenos Aires']],
  por: [[38.72, -9.14, 'Lisbon'], [-23.55, -46.63, 'Sao Paulo']],
  ita: [[41.9, 12.5, 'Rome'], [45.46, 9.19, 'Milan']],
  ron: [[44.43, 26.1, 'Bucharest'], [46.77, 23.6, 'Cluj']],
  fra: [[48.86, 2.35, 'Paris'], [45.5, -73.57, 'Montreal']],
  cat: [[41.39, 2.17, 'Barcelona'], [39.47, -0.38, 'Valencia']],
  deu: [[52.52, 13.4, 'Berlin'], [48.21, 16.37, 'Vienna']],
  nld: [[52.37, 4.9, 'Amsterdam'], [51.05, 3.72, 'Ghent']],
  afr: [[-33.92, 18.42, 'Cape Town'], [-22.56, 17.08, 'Windhoek']],
  swe: [[59.33, 18.07, 'Stockholm'], [57.71, 11.97, 'Gothenburg']],
  dan: [[55.68, 12.57, 'Copenhagen'], [56.16, 10.2, 'Aarhus']],
  nob: [[59.91, 10.75, 'Oslo'], [60.39, 5.32, 'Bergen']],
  isl: [[64.15, -21.94, 'Reykjavik'], [65.68, -18.09, 'Akureyri']],
  fin: [[60.17, 24.94, 'Helsinki'], [61.5, 23.77, 'Tampere']],
  est: [[59.44, 24.75, 'Tallinn'], [58.38, 26.72, 'Tartu']],
  hun: [[47.5, 19.04, 'Budapest'], [46.25, 20.15, 'Szeged']],
  pol: [[52.23, 21.01, 'Warsaw'], [50.06, 19.94, 'Krakow']],
  ces: [[50.08, 14.44, 'Prague'], [49.2, 16.61, 'Brno']],
  hrv: [[45.81, 15.98, 'Zagreb'], [43.51, 16.44, 'Split']],
  lit: [[54.69, 25.28, 'Vilnius'], [54.9, 23.9, 'Kaunas']],
  sqi: [[41.33, 19.82, 'Tirana'], [42.66, 21.16, 'Pristina']],
  eus: [[43.26, -2.93, 'Bilbao'], [43.32, -1.98, 'San Sebastian']],
  cym: [[51.48, -3.18, 'Cardiff'], [53.14, -4.28, 'Caernarfon']],
  tur: [[41.01, 28.98, 'Istanbul'], [39.93, 32.86, 'Ankara']],
  azj: [[40.41, 49.87, 'Baku'], [38.08, 46.29, 'Tabriz']],
  uzn: [[41.31, 69.24, 'Tashkent'], [39.77, 64.42, 'Bukhara']],
  vie: [[21.03, 105.85, 'Hanoi'], [10.82, 106.63, 'Ho Chi Minh City']],
  ind: [[-6.21, 106.85, 'Jakarta'], [3.6, 98.67, 'Medan']],
  zsm: [[3.14, 101.69, 'Kuala Lumpur'], [1.35, 103.82, 'Singapore']],
  tgl: [[14.6, 120.98, 'Manila'], [15.49, 120.97, 'Angeles']],
  swh: [[-6.82, 39.27, 'Dar es Salaam'], [-1.29, 36.82, 'Nairobi']],
  hau: [[12.0, 8.52, 'Kano'], [13.51, 2.11, 'Niamey']],
  yor: [[7.38, 3.9, 'Ibadan'], [6.52, 3.38, 'Lagos']],
  som: [[2.05, 45.34, 'Mogadishu'], [9.56, 44.07, 'Hargeisa']],
  zul: [[-29.86, 31.03, 'Durban'], [-26.2, 28.05, 'Johannesburg']],
  mkd: [[41.99, 21.43, 'Skopje'], [41.03, 21.34, 'Bitola']],
  bel: [[53.9, 27.57, 'Minsk'], [52.1, 23.73, 'Brest']],
  tgk: [[38.56, 68.79, 'Dushanbe'], [40.28, 69.62, 'Khujand']],
  kir: [[42.87, 74.59, 'Bishkek'], [40.53, 72.8, 'Osh']],
  slk: [[48.15, 17.11, 'Bratislava'], [48.72, 21.26, 'Kosice']],
  slv: [[46.06, 14.51, 'Ljubljana'], [46.55, 15.65, 'Maribor']],
  lav: [[56.95, 24.11, 'Riga'], [55.87, 26.52, 'Daugavpils']],
  glg: [[42.88, -8.54, 'Santiago de Compostela'], [42.24, -8.72, 'Vigo']],
  gle: [[53.27, -9.05, 'Galway'], [53.35, -6.26, 'Dublin']],
  gla: [[58.21, -6.39, 'Stornoway'], [57.48, -4.22, 'Inverness']],
  mlt: [[35.9, 14.51, 'Valletta'], [35.88, 14.44, 'Birkirkara']],
  fao: [[62.01, -6.77, 'Torshavn']],
  ltz: [[49.61, 6.13, 'Luxembourg'], [49.5, 5.98, 'Esch']],
  bre: [[48.39, -4.49, 'Brest'], [47.75, -3.37, 'Lorient']],
  fry: [[53.2, 5.79, 'Leeuwarden'], [53.03, 5.66, 'Sneek']],
  div: [[4.17, 73.51, 'Male']],
  bod: [[29.65, 91.13, 'Lhasa'], [36.62, 101.78, 'Xining']],
  dzo: [[27.47, 89.64, 'Thimphu'], [26.86, 89.39, 'Phuentsholing']],
  sat: [[23.35, 85.33, 'Ranchi'], [22.8, 86.19, 'Jamshedpur']],
  mni: [[24.82, 93.94, 'Imphal']],
  chr: [[35.92, -94.97, 'Tahlequah'], [35.47, -83.31, 'Cherokee, NC']],
  iku: [[63.75, -68.52, 'Iqaluit'], [62.81, -92.08, 'Rankin Inlet']],
  nqo: [[9.51, -13.71, 'Conakry'], [11.32, -12.28, 'Kankan']],
  fuf: [[11.32, -12.28, 'Labe area'], [10.38, -12.06, 'Mamou']],
  zgh: [[31.63, -7.99, 'Marrakesh'], [30.42, -9.6, 'Agadir']],
  gom: [[15.5, 73.83, 'Panaji'], [15.28, 73.96, 'Margao']],
  doi: [[32.73, 74.86, 'Jammu']],
  awa: [[26.85, 80.95, 'Lucknow'], [26.47, 80.33, 'Kanpur']],
  new: [[27.67, 85.43, 'Bhaktapur'], [27.67, 85.32, 'Patan']],
  pnb: [[31.55, 74.34, 'Lahore'], [31.42, 73.08, 'Faisalabad']],
  prs: [[34.53, 69.17, 'Kabul'], [36.71, 67.11, 'Mazar-i-Sharif']],
  bal: [[30.18, 66.98, 'Quetta'], [29.5, 60.86, 'Zahedan']],
  kas: [[34.08, 74.8, 'Srinagar'], [33.73, 75.15, 'Anantnag']],
  arz: [[30.04, 31.24, 'Cairo'], [31.2, 29.92, 'Alexandria']],
  ary: [[33.57, -7.59, 'Casablanca'], [34.02, -6.83, 'Rabat']],
  tat: [[55.79, 49.11, 'Kazan'], [55.73, 52.41, 'Naberezhnye Chelny']],
  bak: [[54.74, 55.97, 'Ufa'], [53.63, 55.95, 'Sterlitamak']],
  chv: [[56.13, 47.25, 'Cheboksary']],
  sah: [[62.03, 129.73, 'Yakutsk'], [66.77, 123.37, 'Olenyok area']],
  oss: [[43.02, 44.68, 'Vladikavkaz']],
  che: [[43.32, 45.69, 'Grozny']],
  bos: [[43.86, 18.41, 'Sarajevo'], [44.77, 17.19, 'Banja Luka']],
  oci: [[43.6, 1.44, 'Toulouse'], [43.83, 4.36, 'Nimes']],
  srd: [[39.22, 9.12, 'Cagliari'], [40.73, 8.56, 'Sassari']],
  ast: [[43.36, -5.85, 'Oviedo'], [43.54, -5.66, 'Gijon']],
  roh: [[46.85, 9.53, 'Chur'], [46.5, 9.84, 'Engadin']],
  fur: [[46.06, 13.24, 'Udine'], [45.96, 12.66, 'Pordenone']],
  sme: [[69.65, 18.96, 'Tromso'], [69.0, 23.04, 'Kautokeino']],
  hsb: [[51.19, 14.42, 'Bautzen'], [51.18, 14.44, 'Bautzen east']],
  ibo: [[6.44, 7.5, 'Enugu'], [5.11, 7.37, 'Aba']],
  aka: [[6.69, -1.62, 'Kumasi'], [5.6, -0.19, 'Accra']],
  wol: [[14.72, -17.47, 'Dakar'], [14.79, -16.93, 'Thies']],
  kin: [[-1.94, 30.06, 'Kigali'], [-2.6, 29.74, 'Huye']],
  nya: [[-13.98, 33.79, 'Lilongwe'], [-15.79, 35.01, 'Blantyre']],
  sna: [[-17.83, 31.05, 'Harare'], [-20.15, 28.58, 'Bulawayo']],
  xho: [[-32.98, 27.87, 'East London'], [-33.02, 27.91, 'Mdantsane']],
  sot: [[-29.31, 27.48, 'Maseru'], [-29.12, 26.21, 'Bloemfontein']],
  tsn: [[-24.65, 25.91, 'Gaborone'], [-25.87, 25.64, 'Mafikeng']],
  lug: [[0.31, 32.58, 'Kampala'], [0.34, 32.54, 'Kampala west']],
  lin: [[-4.32, 15.31, 'Kinshasa'], [-4.27, 15.28, 'Brazzaville']],
  bam: [[12.64, -8.0, 'Bamako'], [11.32, -5.67, 'Sikasso']],
  gaz: [[7.68, 36.83, 'Hawassa area'], [9.31, 42.12, 'Harar area']],
  plt: [[-18.88, 47.51, 'Antananarivo'], [-18.15, 49.4, 'Toamasina']],
  jav: [[-7.8, 110.36, 'Yogyakarta'], [-7.25, 112.75, 'Surabaya']],
  sun: [[-6.92, 107.61, 'Bandung'], [-6.32, 106.16, 'Serang']],
  ceb: [[10.32, 123.89, 'Cebu'], [8.48, 124.65, 'Cagayan de Oro']],
  ilo: [[16.62, 120.32, 'Vigan'], [16.04, 120.33, 'Dagupan']],
  kmr: [[37.91, 40.24, 'Diyarbakir'], [37.05, 41.22, 'Qamishli']],
  tuk: [[37.95, 58.38, 'Ashgabat'], [39.08, 63.58, 'Turkmenabat']],
  tet: [[-8.56, 125.57, 'Dili'], [-8.99, 125.41, 'Ainaro area']],
  mri: [[-38.14, 176.25, 'Rotorua'], [-36.85, 174.76, 'Auckland']],
  smo: [[-13.83, -171.77, 'Apia']],
  ton: [[-21.17, -175.15, 'Tongatapu']],
  fij: [[-18.14, 178.44, 'Suva'], [-17.61, 177.45, 'Nadi']],
  haw: [[21.31, -157.86, 'Honolulu'], [19.72, -155.09, 'Hilo']],
  tpi: [[-9.44, 147.18, 'Port Moresby'], [-6.73, 147.0, 'Lae']],
  que: [[-13.53, -71.97, 'Cusco'], [-17.39, -66.16, 'Cochabamba']],
  aym: [[-16.5, -68.15, 'La Paz'], [-15.84, -70.03, 'Puno']],
  grn: [[-25.28, -57.63, 'Asuncion'], [-25.51, -54.61, 'Ciudad del Este']],
  hat: [[18.54, -72.34, 'Port-au-Prince'], [19.76, -72.2, 'Cap-Haitien']],
  pap: [[12.52, -70.03, 'Oranjestad'], [12.11, -68.93, 'Willemstad']],
  kal: [[64.18, -51.72, 'Nuuk'], [69.22, -51.1, 'Ilulissat']],
  yue: [[23.13, 113.26, 'Guangzhou'], [22.32, 114.17, 'Hong Kong']],
};

// The other half of the audit. A region that is too big scores a player
// as right for pinning somewhere the language is not, and no positive
// check can catch that: the way to find over-claiming is to name the
// place it would wrongly cover.
const NOT_HERE = [
  ['ckb', 37.91, 40.24, 'Diyarbakir writes Kurmanji in Latin letters, not Sorani in Arabic ones'],
  ['yue', 39.9, 116.4, 'Beijing does not read written Cantonese'],
  ['aym', -13.53, -71.97, 'Cusco is Quechua'],
  ['prs', 35.69, 51.39, 'Tehran is Persian, and Dari is the Afghan standard'],
  ['pes', 38.56, 68.79, 'Dushanbe is Tajik, the same language in Cyrillic'],
  ['xho', -29.86, 31.03, 'Durban is Zulu'],
  ['ibo', 6.52, 3.38, 'Lagos is Yoruba'],
  ['fry', 52.37, 4.9, 'Amsterdam is Dutch'],
  ['gla', 51.48, -3.18, 'Cardiff is Welsh'],
  ['tam', 30.9, 75.86, 'Ludhiana is Punjabi'],
  ['sun', -7.8, 110.36, 'Yogyakarta is Javanese'],
  ['ilo', 10.32, 123.89, 'Cebu is Cebuano'],
  ['bho', 25.61, 85.14, 'Patna is Magahi, a hundred kilometres east of Bhojpuri'],
];

describe('where each language is used', () => {
  test('every language names at least one place', () => {
    const missing = LANGUAGES.filter((language) => !PLACES[language.code]?.length);
    expect(missing.map((l) => l.code)).toEqual([]);
    for (const code of Object.keys(PLACES)) {
      expect(LANGUAGES.some((l) => l.code === code)).toBe(true);
    }
  });

  test('and the region really covers it, so the round scores full marks there', () => {
    const wrong = [];
    for (const language of LANGUAGES) {
      for (const [lat, lng, where] of PLACES[language.code] || []) {
        const here = languagesAt({ lat, lng }).map((l) => l.code);
        const scored = scoreScriptGuess({ guess: { lat, lng }, language, ladder: 'world' });
        if (!here.includes(language.code)) {
          wrong.push(`${language.code} (${language.name}): ${where} is outside it, ${Math.round(scored.distanceKm)} km away`);
        } else if (scored.points !== 5000) {
          wrong.push(`${language.code}: ${where} is inside it but scored ${scored.points}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  test('and does not cover somewhere it is not used', () => {
    const over = [];
    for (const [code, lat, lng, why] of NOT_HERE) {
      const language = LANGUAGES.find((l) => l.code === code);
      expect(language).toBeTruthy();
      const here = languagesAt({ lat, lng }).map((l) => l.code);
      if (here.includes(code)) over.push(`${code} covers ${lat},${lng}: ${why}`);
    }
    expect(over).toEqual([]);
  });
});
