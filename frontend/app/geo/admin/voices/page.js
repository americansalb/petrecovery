'use client';

/**
 * /geo/admin/voices: Voices (beta), the ElevenLabs voices that read
 * Script rounds aloud. The server decides who may see it
 * (app/lib/geo/server/admin.js); this route only renders. The Suspense
 * is for useSearchParams, which carries the chosen language.
 */

import { Suspense } from 'react';
import VoicesClient from '../../components/voices/VoicesClient';

export default function GeoAdminVoicesPage() {
  return (
    <Suspense fallback={null}>
      <VoicesClient />
    </Suspense>
  );
}
