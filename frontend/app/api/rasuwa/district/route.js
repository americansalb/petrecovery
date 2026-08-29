import { NextResponse } from 'next/server';

/**
 * GET /api/rasuwa/district?address=...
 *
 * Resolves a U.S. street address to a state + congressional district for
 * the /rasuwa letter tool, via the Census Bureau geocoder (public domain,
 * no API key). The geocoder sends no CORS headers, so the browser cannot
 * call it directly; this proxy exists only for that. The address is
 * forwarded to census.gov and returned to the caller. It is not logged
 * and not stored; keep it that way, the callers are families of missing
 * people entering home addresses.
 *
 * Rate limited in middleware.js ('/api/rasuwa/district').
 */

export const dynamic = 'force-dynamic';

// Census returns state as a FIPS code; the directory keys on USPS codes.
const FIPS_TO_STATE = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO',
  '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI',
  '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY',
  '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
  '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY', '60': 'AS', '66': 'GU', '69': 'MP',
  '72': 'PR', '78': 'VI',
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = (searchParams.get('address') || '').trim().slice(0, 250);
  if (address.length < 8) {
    return NextResponse.json({ error: 'Enter a full street address, city, state, and ZIP.' }, { status: 400 });
  }

  const params = new URLSearchParams({
    address,
    benchmark: 'Public_AR_Current',
    vintage: 'Current_Current',
    layers: 'all',
    format: 'json',
  });

  let data;
  try {
    const res = await fetch(
      `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?${params.toString()}`,
      { signal: AbortSignal.timeout(10000), cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`census status ${res.status}`);
    data = await res.json();
  } catch {
    return NextResponse.json(
      { error: 'The district lookup did not respond. Pick your state and district by hand below.' },
      { status: 502 }
    );
  }

  const match = data?.result?.addressMatches?.[0];
  if (!match) {
    return NextResponse.json(
      { error: 'No match for that address. Check the spelling and ZIP, or pick your state by hand below.' },
      { status: 404 }
    );
  }

  // The layer name carries the congress number ("119th Congressional
  // Districts"), so match by suffix instead of pinning a session.
  const layerKey = Object.keys(match.geographies || {}).find((k) => /Congressional Districts$/.test(k));
  const cd = layerKey ? match.geographies[layerKey]?.[0] : null;
  const state = cd ? FIPS_TO_STATE[cd.STATE] : null;
  if (!cd || !state) {
    return NextResponse.json(
      { error: 'That address did not resolve to a congressional district. Pick your state by hand below.' },
      { status: 404 }
    );
  }

  // 98/99 are the delegate and undefined encodings; the directory stores
  // at-large seats and delegates as district 0.
  const parsed = parseInt(cd.BASENAME, 10);
  const district = Number.isNaN(parsed) || parsed >= 98 ? 0 : parsed;

  return NextResponse.json(
    { state, district, matchedAddress: match.matchedAddress },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
