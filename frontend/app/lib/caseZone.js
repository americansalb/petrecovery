import tzLookup from 'tz-lookup';

/**
 * The IANA time zone where the pet was last seen, from the case's position;
 * Chicago when the case has no usable one. Dates about the case are written
 * in this zone everywhere (the flyer, the page) so they agree: the server
 * runs in UTC, where an Austin evening is already tomorrow, and a reader may
 * be anywhere.
 */
export function zoneFor(caseData) {
  const lat = Number(caseData?.lastSeenLatitude);
  const lon = Number(caseData?.lastSeenLongitude);
  if (Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0)) {
    try {
      return tzLookup(lat, lon);
    } catch {
      /* fall through */
    }
  }
  return 'America/Chicago';
}
