'use client';

/**
 * Case Command Center Page
 *
 * Per spec: This IS the Case Command Center - the full tactical page for a single lost pet.
 * The purpose is to answer "How do we find this specific pet, step by step, with everyone coordinated?"
 *
 * Route: /cases/[caseNumber]
 *
 * This page directly renders the CaseCommandCenter component. There is no separate
 * "public view" vs "command center view" toggle - this IS the case page.
 *
 * For users who are not logged in or not authorized, the CaseCommandCenter component
 * will show appropriate information based on their access level.
 */

import { useParams } from 'next/navigation';
import CaseCommandCenter from '@/app/components/case/CaseCommandCenter';

export default function CaseDetailPage() {
  const params = useParams();
  const { caseNumber } = params;

  // Render the Case Command Center directly
  // The component handles all authentication, role detection, and appropriate UI rendering
  return (
    <CaseCommandCenter
      caseNumber={caseNumber}
      // No onClose - this is the main page, not an overlay
      // Navigation back to squad hub is handled within the component
    />
  );
}
