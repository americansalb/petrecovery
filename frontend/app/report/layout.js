/**
 * Report Layout - Full screen wizard that overlays the navigation
 * Uses fixed positioning to cover entire viewport including nav bar
 */

import { buildShareMetadata } from '@/app/lib/shareMetadata';

export const metadata = buildShareMetadata({
  title: 'Report a Pet | ReunitePets',
  description: 'Report a lost or found pet in about a minute — free, no app needed.',
  index: true,
});

export default function ReportLayout({ children }) {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {children}
    </div>
  );
}
