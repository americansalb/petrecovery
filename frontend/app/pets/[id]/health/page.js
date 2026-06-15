/**
 * Old route, new home: the Health Book is now a section of the single
 * pet dashboard (/pets/[id]). Old links and muscle memory keep working.
 */

import { redirect } from 'next/navigation';

export default async function HealthRedirect({ params }) {
  const { id } = await params;
  redirect(`/pets/${id}`);
}
