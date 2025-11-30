import { redirect } from 'next/navigation';

/**
 * Redirect /cases/report to /report/new
 *
 * The old /cases/report page has been consolidated into /report/new
 * which provides a better UX with:
 * - Modern bioluminescent design matching Squad Hub
 * - Multi-step wizard with progress indicator
 * - Map-based location selection
 * - Proper Case model integration (not LostPetCase)
 * - Squad/patrol member alerting
 */
export default function CasesReportRedirect() {
  redirect('/report/new');
}
