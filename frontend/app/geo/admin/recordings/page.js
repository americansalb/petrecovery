'use client';

/**
 * /geo/admin/recordings: review what the public recorded for Voices
 * (components/recordings/RecordingsAdmin.js). The server decides who may
 * see it (app/lib/geo/server/admin.js); this route only renders.
 */

import RecordingsAdmin from '../../components/recordings/RecordingsAdmin';

export default function GeoAdminRecordingsPage() {
  return <RecordingsAdmin />;
}
