/**
 * Old route, new home: "Today" is now the lead section of the single
 * pet dashboard (/pets/[id]). Old links and muscle memory keep working.
 */

import { redirect } from 'next/navigation';

export default async function TodayRedirect({ params }) {
  const { id } = await params;
  redirect(`/pets/${id}`);
}
