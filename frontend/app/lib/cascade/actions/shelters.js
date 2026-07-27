/**
 * shelters action (tier 0) - a shortlist of the nearest shelters / animal
 * control the owner can call today (where lost pets most often end up). Uses
 * the key-free local shelter DB; when it's empty, returns honest, actionable
 * guidance rather than a fake list.
 */

import { getSheltersNearLocation } from '@/app/lib/shelters/index.js';
import { calculateDistance } from '@/app/lib/matching';

export async function runShelters(ctx) {
  const lat = ctx.case.lastSeenLatitude;
  const lng = ctx.case.lastSeenLongitude;

  let shelters = [];
  try {
    if (typeof lat === 'number' && typeof lng === 'number') {
      const rows = await getSheltersNearLocation(lat, lng, 30);
      shelters = rows
        .map((r) => ({
          name: r.name,
          address: [r.address, r.city, r.state].filter(Boolean).join(', '),
          phone: r.phone || null,
          distanceMi:
            typeof r.latitude === 'number' && typeof r.longitude === 'number'
              ? Math.round(calculateDistance(lat, lng, r.latitude, r.longitude) * 10) / 10
              : null,
        }))
        .sort((a, b) => (a.distanceMi ?? 999) - (b.distanceMi ?? 999))
        .slice(0, 8);
    }
  } catch (err) {
    console.error('[shelters] lookup failed:', err.message);
  }

  const guidance =
    shelters.length === 0
      ? 'Call every animal shelter, humane society, and animal-control office within ~20 miles and file a lost-pet report - check back every 1–2 days, since many pets are surrendered days after going missing.'
      : null;

  return { count: shelters.length, result: { shelters, guidance } };
}
