/**
 * Admin section layout.
 *
 * Only job is to hold the section until the session is known - see
 * AdminGate. Admin pages are never shareable, so no share metadata here;
 * robots stay off them via the noindex below.
 */

import AdminGate from './AdminGate';

export const metadata = {
  title: 'Admin | ReunitePets',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return <AdminGate>{children}</AdminGate>;
}
