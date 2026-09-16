'use client';

/**
 * /geo/admin: the backend. The server decides who may see it
 * (app/lib/geo/server/admin.js); this route only renders.
 */

import AdminClient from '../components/AdminClient';

export default function GeoAdminPage() {
  return <AdminClient />;
}
