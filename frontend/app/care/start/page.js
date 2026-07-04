'use client';

/**
 * /care/start — the one add-a-pet wizard, for guests and members alike
 * (/pets/new 301s here). Share metadata comes from app/care/layout.js.
 */

import PetWizard from '@/app/components/care/PetWizard';

export default function HealthBookStart() {
  return <PetWizard />;
}
