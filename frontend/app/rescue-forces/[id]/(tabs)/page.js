/**
 * A Rescue Force's page, Pets tab: the pets lost and found in its area
 * (reunited ones when asked for), beside the map on a computer. The header,
 * map and tabs come from ./layout.js.
 *
 * Server-rendered for link previews and search engines; the share card is
 * the force's (./forceMetadata.js).
 */

import { notFound } from 'next/navigation';
import { getForcePage } from '@/app/lib/forcePage';
import { forceMetadata } from './forceMetadata';
import PetsTab from './PetsTab';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { id } = await params;
  return forceMetadata(id);
}

export default async function ForcePetsPage({ params, searchParams }) {
  const { id } = await params;
  const query = (await searchParams) || {};
  const data = await getForcePage(id);
  if (!data) notFound();
  const justCreated = query.created === 'true' && data.viewer.role === 'FOUNDER';
  return <PetsTab justCreated={justCreated} />;
}
