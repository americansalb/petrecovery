/**
 * Old route, new home: care routines live on the unified Today
 * checklist (docs/PRODUCT_IA_PLAN.md §3).
 */

import { redirect } from 'next/navigation';

export default async function CareRedirect({ params }) {
  const { id } = await params;
  redirect(`/pets/${id}/today`);
}
