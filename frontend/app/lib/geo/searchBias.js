/**
 * Where to look first when someone types an address.
 *
 * A typed search with no hint about where the person is returns the whole
 * world: "5th and Congress" came back as a congress centre in Varna and a
 * party office in Wuhan. The old fix was a hard filter to the United
 * States, which made typed search useless everywhere else the site is used
 * (Puerto Rico, Bolivia, Mexico). So the search is BIASED, not fenced:
 *
 *  - the device's time zone names the country when it can (no network, no
 *    permission prompt; "America/La_Paz" is Bolivia, every US zone is the US);
 *  - a known position (the pin, the last "Use my location") gives a box the
 *    geocoder prefers results inside of without excluding the rest.
 */

const ZONE_COUNTRY = {
  // United States, including the zones Intl reports on phones
  'America/New_York': 'us', 'America/Detroit': 'us', 'America/Kentucky/Louisville': 'us',
  'America/Kentucky/Monticello': 'us', 'America/Indiana/Indianapolis': 'us', 'America/Indiana/Vincennes': 'us',
  'America/Indiana/Winamac': 'us', 'America/Indiana/Marengo': 'us', 'America/Indiana/Petersburg': 'us',
  'America/Indiana/Vevay': 'us', 'America/Chicago': 'us', 'America/Indiana/Tell_City': 'us',
  'America/Indiana/Knox': 'us', 'America/Menominee': 'us', 'America/North_Dakota/Center': 'us',
  'America/North_Dakota/New_Salem': 'us', 'America/North_Dakota/Beulah': 'us', 'America/Denver': 'us',
  'America/Boise': 'us', 'America/Phoenix': 'us', 'America/Los_Angeles': 'us', 'America/Anchorage': 'us',
  'America/Juneau': 'us', 'America/Sitka': 'us', 'America/Metlakatla': 'us', 'America/Yakutat': 'us',
  'America/Nome': 'us', 'America/Adak': 'us', 'Pacific/Honolulu': 'us', 'US/Eastern': 'us',
  'US/Central': 'us', 'US/Mountain': 'us', 'US/Pacific': 'us', 'US/Arizona': 'us', 'US/Alaska': 'us', 'US/Hawaii': 'us',
  // Territories and neighbours
  'America/Puerto_Rico': 'pr', 'America/St_Thomas': 'vi', 'Pacific/Guam': 'gu',
  'America/Toronto': 'ca', 'America/Vancouver': 'ca', 'America/Edmonton': 'ca', 'America/Winnipeg': 'ca',
  'America/Halifax': 'ca', 'America/St_Johns': 'ca', 'America/Regina': 'ca', 'America/Moncton': 'ca',
  'America/Mexico_City': 'mx', 'America/Cancun': 'mx', 'America/Merida': 'mx', 'America/Monterrey': 'mx',
  'America/Matamoros': 'mx', 'America/Chihuahua': 'mx', 'America/Ciudad_Juarez': 'mx', 'America/Ojinaga': 'mx',
  'America/Mazatlan': 'mx', 'America/Hermosillo': 'mx', 'America/Tijuana': 'mx', 'America/Bahia_Banderas': 'mx',
  // Central America and the Caribbean
  'America/Guatemala': 'gt', 'America/El_Salvador': 'sv', 'America/Tegucigalpa': 'hn', 'America/Managua': 'ni',
  'America/Costa_Rica': 'cr', 'America/Panama': 'pa', 'America/Belize': 'bz', 'America/Santo_Domingo': 'do',
  'America/Havana': 'cu', 'America/Jamaica': 'jm', 'America/Port-au-Prince': 'ht',
  // South America
  'America/La_Paz': 'bo', 'America/Bogota': 'co', 'America/Lima': 'pe', 'America/Guayaquil': 'ec',
  'America/Caracas': 've', 'America/Santiago': 'cl', 'America/Punta_Arenas': 'cl', 'America/Asuncion': 'py',
  'America/Montevideo': 'uy', 'America/Guyana': 'gy', 'America/Paramaribo': 'sr',
  'America/Sao_Paulo': 'br', 'America/Bahia': 'br', 'America/Fortaleza': 'br', 'America/Recife': 'br',
  'America/Belem': 'br', 'America/Manaus': 'br', 'America/Cuiaba': 'br', 'America/Campo_Grande': 'br',
  'America/Porto_Velho': 'br', 'America/Boa_Vista': 'br', 'America/Rio_Branco': 'br', 'America/Maceio': 'br',
  'America/Araguaina': 'br', 'America/Santarem': 'br', 'America/Noronha': 'br',
  // Europe, where the diaspora shares links
  'Europe/Madrid': 'es', 'Atlantic/Canary': 'es', 'Europe/London': 'gb', 'Europe/Dublin': 'ie',
  'Europe/Lisbon': 'pt', 'Europe/Paris': 'fr', 'Europe/Berlin': 'de', 'Europe/Rome': 'it', 'Europe/Amsterdam': 'nl',
};

for (const z of [
  'America/Argentina/Buenos_Aires', 'America/Argentina/Cordoba', 'America/Argentina/Salta', 'America/Argentina/Jujuy',
  'America/Argentina/Tucuman', 'America/Argentina/Catamarca', 'America/Argentina/La_Rioja', 'America/Argentina/San_Juan',
  'America/Argentina/Mendoza', 'America/Argentina/San_Luis', 'America/Argentina/Rio_Gallegos', 'America/Argentina/Ushuaia',
  'America/Buenos_Aires',
]) {
  ZONE_COUNTRY[z] = 'ar';
}

/** The device's IANA time zone, or '' when the browser will not say. */
export function deviceZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

/** The ISO country code the time zone implies, or '' when unknown. */
export function countryForZone(zone) {
  return ZONE_COUNTRY[zone] || '';
}

/**
 * Query parameters that bias a Nominatim search toward where the person is.
 * `near` is { lat, lng } when a position is already known. The box is about
 * 60 miles across and is a preference (bounded=0), never a fence.
 */
export function searchBiasParams({ near = null, zone = deviceZone() } = {}) {
  const params = {};
  if (near && Number.isFinite(near.lat) && Number.isFinite(near.lng)) {
    const d = 0.45;
    const lonPad = d / Math.max(0.2, Math.cos((near.lat * Math.PI) / 180));
    params.viewbox = [near.lng - lonPad, near.lat + d, near.lng + lonPad, near.lat - d]
      .map((n) => n.toFixed(4))
      .join(',');
    params.bounded = '0';
  }
  const country = countryForZone(zone);
  if (country) params.countrycodes = country;
  return params;
}
