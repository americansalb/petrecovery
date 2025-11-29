'use client';

/**
 * Squad Hub Page
 *
 * Main page for a city's rescue squad.
 * Displays the Squad Hub with case queue, map, and activity panels.
 *
 * Route: /rescue-squads/[citySlug]
 */

import { useParams } from 'next/navigation';
import SquadHub from '@/components/squad/SquadHub';
import { getMockSquadData } from '@/lib/mockSquadData';

export default function SquadPage() {
  const params = useParams();
  const citySlug = params.id;

  // For now, use mock data
  // TODO: Replace with actual API call: GET /api/squads/[citySlug]/hub
  const squadData = getMockSquadData(citySlug);

  return <SquadHub initialData={squadData} />;
}
