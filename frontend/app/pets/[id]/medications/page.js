/**
 * Old route, new home: medications live in the Health Book section of
 * the single pet dashboard (/pets/[id]). Muscle memory keeps working.
 */

import { redirect } from 'next/navigation';

export default async function MedicationsRedirect({ params }) {
  const { id } = await params;
  redirect(`/pets/${id}`);
}
