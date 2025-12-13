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

    console.log('[ShelterEnrich] Received request with', shelters?.length, 'shelters');

    if (!Array.isArray(shelters) || shelters.length === 0) {
      return NextResponse.json({ error: 'No shelters provided' }, { status: 400 });
    }

    let updatedCount = 0;
    let skippedNoId = 0;
    let skippedNoData = 0;

    for (const shelter of shelters) {
      // Only update if we have an ID and some data to save
      if (!shelter.id && !shelter.appleMapKitId) {
        skippedNoId++;
        console.log('[ShelterEnrich] Skipped (no ID):', shelter.name);
        continue;
      }

      // Only update if there's actually new data
      const hasPhone = shelter.phone && typeof shelter.phone === 'string' && shelter.phone.trim();
      const hasWebsite = shelter.website && typeof shelter.website === 'string' && shelter.website.trim();
      const hasHours = shelter.hours;

      if (!hasPhone && !hasWebsite && !hasHours) {
        skippedNoData++;
        console.log('[ShelterEnrich] Skipped (no data):', shelter.name, { phone: shelter.phone, website: shelter.website });
        continue;
      }

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

        console.log('[ShelterEnrich] Updating:', shelter.name, 'with', updateData);

        // Try to update by database ID first, then by appleMapKitId
        if (shelter.id) {
          const result = await prisma.shelter.update({
            where: { id: shelter.id },
            data: updateData,
          });
          console.log('[ShelterEnrich] Updated by ID:', result.name);
          updatedCount++;
        } else if (shelter.appleMapKitId) {
          const result = await prisma.shelter.updateMany({
            where: { appleMapKitId: shelter.appleMapKitId },
            data: updateData,
          });
          console.log('[ShelterEnrich] Updated by appleMapKitId:', result.count);
          updatedCount++;
        }
      } catch (err) {
        console.error('[ShelterEnrich] Failed to update shelter:', shelter.name, err.message);
      }
    }

    console.log('[ShelterEnrich] Summary: updated', updatedCount, 'skippedNoId', skippedNoId, 'skippedNoData', skippedNoData);

    return NextResponse.json({
      success: true,
      updatedCount,
      skippedNoId,
      skippedNoData,
    });
  } catch (error) {
    console.error('[ShelterEnrich] Error:', error);
    return NextResponse.json(
      { error: 'Failed to enrich shelters', details: error.message },
      { status: 500 }
    );
  }
}
