import { redirect } from 'next/navigation';

/**
 * Redirect /found to /report/found
 * This route is deprecated - use /report/found instead
 */
export default function FoundRedirect() {
  redirect('/report/found');
}
