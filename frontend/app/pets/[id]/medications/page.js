/**
 * Old route, new home: this was the medications MANAGEMENT page, so it
 * lands on the Health Book's medications section (daily check-offs
 * live in /today). Muscle memory keeps working.
 */

import { redirect } from 'next/navigation';

export default async function MedicationsRedirect({ params }) {
  const { id } = await params;
  redirect(`/pets/${id}/health`);
}
