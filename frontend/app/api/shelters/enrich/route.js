import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/shelters/enrich
 *
 * Save enriched shelter data (phone, website, hours) from client-side MapKit JS
 * This data is only available via the client-side API, not the server API.
 */
export async function POST(request) {
  try {
    const { shelters } = await request.json();

    if (!Array.isArray(shelters) || shelters.length === 0) {
      return NextResponse.json({ error: 'No shelters provided' }, { status: 400 });
    }

    let updatedCount = 0;

    for (const shelter of shelters) {
      // Only update if we have an ID and some data to save
      if (!shelter.id && !shelter.appleMapKitId) continue;

      // Only update if there's actually new data
      const hasPhone = shelter.phone && shelter.phone.trim();
      const hasWebsite = shelter.website && shelter.website.trim();
      const hasHours = shelter.hours;

      if (!hasPhone && !hasWebsite && !hasHours) continue;

      try {
        // Build update data - only include fields that have values
        const updateData = {};
        if (hasPhone) updateData.phone = shelter.phone.trim();
        if (hasWebsite) updateData.website = shelter.website.trim();
        if (hasHours) {
          updateData.hours = typeof shelter.hours === 'string'
            ? shelter.hours
            : JSON.stringify(shelter.hours);
        }

        // Try to update by database ID first, then by appleMapKitId
        if (shelter.id) {
          await prisma.shelter.update({
            where: { id: shelter.id },
            data: updateData,
          });
          updatedCount++;
        } else if (shelter.appleMapKitId) {
          await prisma.shelter.updateMany({
            where: { appleMapKitId: shelter.appleMapKitId },
            data: updateData,
          });
          updatedCount++;
        }
      } catch (err) {
        // Silently skip individual update failures
        console.warn('[ShelterEnrich] Failed to update shelter:', shelter.name, err.message);
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount,
    });
  } catch (error) {
    console.error('[ShelterEnrich] Error:', error);
    return NextResponse.json(
      { error: 'Failed to enrich shelters', details: error.message },
      { status: 500 }
    );
  }
}
