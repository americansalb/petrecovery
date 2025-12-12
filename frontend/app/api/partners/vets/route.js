import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { findNearbyVetClinics, sendLostPetAlertToClinics, registerPartnerClinic } from '@/app/lib/partners/vetClinics';

/**
 * GET /api/partners/vets
 * Search for nearby veterinary clinics
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat'));
    const lng = parseFloat(searchParams.get('lng'));
    const radius = parseInt(searchParams.get('radius')) || 25;

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'Valid latitude and longitude are required' },
        { status: 400 }
      );
    }

    const clinics = await findNearbyVetClinics(lat, lng, radius);

    return NextResponse.json({
      clinics,
      count: clinics.length,
      searchRadius: radius,
      center: { lat, lng },
    });
  } catch (error) {
    console.error('Vet search error:', error);
    return NextResponse.json(
      { error: 'Failed to search for vet clinics' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partners/vets
 * Send lost pet alert to clinics or register new partner
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'alert') {
      // Send lost pet alert to clinics
      const { missionData, clinicIds } = body;

      if (!missionData || !clinicIds?.length) {
        return NextResponse.json(
          { error: 'Case data and clinic IDs are required' },
          { status: 400 }
        );
      }

      // Get clinic details (in production, fetch from database)
      const clinics = clinicIds.map(id => ({
        id,
        isPartner: true,
        alertEmail: `clinic-${id}@example.com`, // Placeholder
      }));

      const results = await sendLostPetAlertToClinics(missionData, clinics);

      return NextResponse.json({
        success: true,
        alertsSent: results.filter(r => r.success).length,
        results,
      });
    }

    if (action === 'register') {
      // Register new partner clinic
      const { clinicData } = body;

      if (!clinicData?.name || !clinicData?.email) {
        return NextResponse.json(
          { error: 'Clinic name and email are required' },
          { status: 400 }
        );
      }

      const clinic = await registerPartnerClinic({
        ...clinicData,
        registeredById: session.user.id,
      });

      return NextResponse.json({
        success: true,
        clinic,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "alert" or "register"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Vet clinic action error:', error);
    return NextResponse.json(
      { error: 'Failed to process vet clinic action' },
      { status: 500 }
    );
  }
}
