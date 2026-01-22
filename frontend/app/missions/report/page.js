import { redirect } from 'next/navigation';

/**
 * Redirect /missions/report to /report/new
 *
 * The old /missions/report page has been consolidated into /report/new
 * which provides a better UX with:
 * - Modern bioluminescent design matching Force Hub
 * - Multi-step wizard with progress indicator
 * - Map-based location selection
 * - Proper Case model integration (not LostPetCase)
 * - Force/patrol member alerting
 */
export default function CasesReportRedirect() {
  redirect('/report/new');
}
