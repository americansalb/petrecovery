/**
 * Old route, new home: care routines live in the Today section of the
 * single pet dashboard (/pets/[id]).
 */

import { redirect } from 'next/navigation';

export default async function CareRedirect({ params }) {
  const { id } = await params;
  redirect(`/pets/${id}`);
}
