/**
 * Where a map opens for someone to put a pin on by hand, when nothing says
 * where they are: location turned off, and the street lookup not answering.
 *
 * The device's time zone is the only hint, and it costs nothing (no network,
 * no permission prompt): the same reading that leans a typed search toward
 * the right country (app/lib/geo/searchBias.js). It names a country, or for
 * the United States a time-zone region, and the map opens showing all of
 * it. A zone it does not know opens the whole world. This is where the map
 * starts, never a place: no pin is put from it, and the picker
 * (app/components/report/LocationPicker.js) asks the person to zoom in
 * before a tap can put the pin.
 *
 * Each view is [lat, lng, km]: the middle, and about how much ground across
 * to show. Country middles are from app/lib/geo/data/countries-meta.json.
 */

import { deviceZone, countryForZone } from '@/app/lib/geo/searchBias';

const ALASKA = [62, -152, 2000];
const HAWAII = [20.6, -157.4, 600];

// The United States by time-zone region, since one view of the whole country starts a long way from anyone.
const US_REGION = {
  eastern: [36.5, -80, 2400],
  central: [37, -93, 2400],
  mountain: [40, -110, 1800],
  pacific: [41, -120, 2000],
};

const ZONE_VIEW = {
  'America/New_York': US_REGION.eastern, 'America/Detroit': US_REGION.eastern, 'US/Eastern': US_REGION.eastern,
  'America/Kentucky/Louisville': US_REGION.eastern, 'America/Kentucky/Monticello': US_REGION.eastern,
  'America/Indiana/Indianapolis': US_REGION.eastern, 'America/Indiana/Vincennes': US_REGION.eastern,
  'America/Indiana/Winamac': US_REGION.eastern, 'America/Indiana/Marengo': US_REGION.eastern,
  'America/Indiana/Petersburg': US_REGION.eastern, 'America/Indiana/Vevay': US_REGION.eastern,
  'America/Chicago': US_REGION.central, 'US/Central': US_REGION.central, 'America/Menominee': US_REGION.central,
  'America/Indiana/Tell_City': US_REGION.central, 'America/Indiana/Knox': US_REGION.central,
  'America/North_Dakota/Center': US_REGION.central, 'America/North_Dakota/New_Salem': US_REGION.central,
  'America/North_Dakota/Beulah': US_REGION.central,
  'America/Denver': US_REGION.mountain, 'America/Boise': US_REGION.mountain, 'America/Phoenix': US_REGION.mountain,
  'US/Mountain': US_REGION.mountain, 'US/Arizona': US_REGION.mountain,
  'America/Los_Angeles': US_REGION.pacific, 'US/Pacific': US_REGION.pacific,
  'America/Anchorage': ALASKA, 'America/Juneau': ALASKA, 'America/Sitka': ALASKA, 'America/Metlakatla': ALASKA,
  'America/Yakutat': ALASKA, 'America/Nome': ALASKA, 'America/Adak': ALASKA, 'US/Alaska': ALASKA,
  'Pacific/Honolulu': HAWAII, 'US/Hawaii': HAWAII,
  // The Canary Islands keep Spain's code but are far from it.
  'Atlantic/Canary': [28.3, -15.8, 500],
};

const COUNTRY_VIEW = {
  us: [39.5, -98.5, 4500], // the lower 48, for a US zone not named above
  pr: [18.25, -66.5, 150],
  vi: [18.35, -64.93, 150],
  gu: [13.47, 144.78, 150],
  ca: [52, -96, 4500],
  mx: [23, -102, 1800],
  gt: [15.5, -90.25, 450],
  sv: [13.83, -88.92, 200],
  hn: [15, -86.5, 450],
  ni: [13, -85, 450],
  cr: [10, -84, 300],
  pa: [9, -80, 350],
  bz: [17.25, -88.75, 200],
  do: [19, -70.67, 300],
  cu: [21.5, -80, 450],
  jm: [18.25, -77.5, 150],
  ht: [19, -72.42, 200],
  bo: [-17, -65, 1350],
  co: [4, -72, 1400],
  pe: [-10, -76, 1450],
  ec: [-2, -77.5, 700],
  ve: [8, -66, 1250],
  cl: [-33, -71, 1800],
  py: [-23, -58, 850],
  uy: [-33, -56, 550],
  gy: [5, -59, 600],
  sr: [4, -56, 550],
  br: [-12, -50, 3800],
  ar: [-36, -64, 2400],
  es: [40, -4, 900],
  gb: [54, -2, 900],
  ie: [53, -8, 450],
  pt: [39.5, -8, 600],
  fr: [46, 2, 1000],
  de: [51, 10, 850],
  it: [42, 12.5, 1100],
  nl: [52.2, 5.5, 300],
};

/** The whole world, for a zone that names nowhere the site knows. */
export const WORLD_VIEW = { lat: 20, lng: 0, km: null, zoom: 2 };

/**
 * Where to open a map with nothing else to go on: { lat, lng, km } for the
 * region the time zone names, or WORLD_VIEW. Always a fresh object.
 */
export function roughStart(zone = deviceZone()) {
  const view = ZONE_VIEW[zone] || COUNTRY_VIEW[countryForZone(zone)];
  if (!view) return { ...WORLD_VIEW };
  const [lat, lng, km] = view;
  return { lat, lng, km };
}

/** A box about `km` across around a point, as Leaflet's [[south, west], [north, east]]. */
export function boxAround({ lat, lng }, km) {
  const dLat = km / 2 / 111;
  const dLng = km / 2 / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return [
    [Math.max(-85, lat - dLat), lng - dLng],
    [Math.min(85, lat + dLat), lng + dLng],
  ];
}
