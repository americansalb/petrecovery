import { redirect } from 'next/navigation';

// Canonical Terms page lives at /terms. Registration and some legacy links point
// at /legal/terms — redirect so those don't 404.
export default function LegalTermsRedirect() {
  redirect('/terms');
}
