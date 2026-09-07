'use client';

/**
 * /geo/me: your profile in the game. Name, rating, points, country
 * badges, today's play meter, and the shop for cosmetics
 * (docs/GEO.md, "Points and cosmetics"). Ordinary page under the
 * universal bar with the game's subtabs.
 */

import ProfileClient from '../components/ProfileClient';

export default function GeoProfilePage() {
  return <ProfileClient />;
}
