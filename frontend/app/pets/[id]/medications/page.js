/**
 * Old route, new home: daily dose logging is /today, management is
 * /health (docs/PRODUCT_IA_PLAN.md §3). Muscle memory keeps working.
 */

import { redirect } from 'next/navigation';

export default async function MedicationsRedirect({ params }) {
  const { id } = await params;
  redirect(`/pets/${id}/today`);
}
