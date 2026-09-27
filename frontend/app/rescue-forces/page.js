/**
 * Rescue Forces: find the one for your town, on a map and in a list.
 *
 * A Rescue Force is a group of volunteers for an area. When a pet is
 * reported lost inside a force's area, the report is assigned to it
 * (app/api/reports/create), it shows on the force's page, and members can
 * join the search. That is all this page claims.
 *
 * The data comes from app/lib/forceDirectory.js; ./ForceDirectory.js draws
 * it like the shelters directory: the map of every force's area beside the
 * list, one search for a town or ZIP code, and "Near me". The list is in
 * the server-rendered HTML for search engines; the map is client-only.
 * Metadata lives in ./layout.js. Old /rescue-forces/search links arrive
 * here through a redirect in next.config.js, query and all.
 */

import { getForceDirectory } from '@/app/lib/forceDirectory';
import ForceDirectory from './ForceDirectory';

export const dynamic = 'force-dynamic';

export default async function RescueForcesPage() {
  const forces = await getForceDirectory();
  return <ForceDirectory forces={forces} />;
}
