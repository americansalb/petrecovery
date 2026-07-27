/**
 * Old route, new home: this was the medications MANAGEMENT page, so it
 * lands on the Meds tab (manage the list, schedules, supply). Daily
 * check-offs live on /today; the Health tab is vaccines/weight/vet, not
 * medications. Muscle memory keeps working.
 */

import { redirect } from 'next/navigation';

export default async function MedicationsRedirect({ params }) {
  const { id } = await params;
  redirect(`/pets/${id}/meds`);
}
