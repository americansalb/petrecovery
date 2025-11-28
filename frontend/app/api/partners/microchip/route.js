import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { searchMicrochip, validateMicrochipNumber, identifyMicrochipManufacturer } from '@/app/lib/partners/microchip';

/**
 * GET /api/partners/microchip?chip=XXXXXXXXXXXXXXX
 * Search for a pet by microchip number
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const chipNumber = searchParams.get('chip');

    if (!chipNumber) {
      return NextResponse.json(
        { error: 'Microchip number is required' },
        { status: 400 }
      );
    }

    // Validate format
    const validation = validateMicrochipNumber(chipNumber);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Identify manufacturer
    const manufacturer = identifyMicrochipManufacturer(validation.cleaned);

    // Search registries
    const results = await searchMicrochip(validation.cleaned);

    return NextResponse.json({
      ...results,
      format: validation.format,
      manufacturer,
    });
  } catch (error) {
    console.error('Microchip search error:', error);
    return NextResponse.json(
      { error: 'Failed to search microchip registries' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partners/microchip
 * Report a found pet with microchip
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { chipNumber, location, caseId } = body;

    if (!chipNumber) {
      return NextResponse.json(
        { error: 'Microchip number is required' },
        { status: 400 }
      );
    }

    // Validate format
    const validation = validateMicrochipNumber(chipNumber);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Import and use the report function
    const { reportFoundMicrochip } = await import('@/app/lib/partners/microchip');

    const results = await reportFoundMicrochip({
      chipNumber: validation.cleaned,
      finderName: session.user.name,
      finderEmail: session.user.email,
      location,
      caseId,
    });

    return NextResponse.json({
      success: true,
      registriesNotified: results.filter(r => r.success).length,
      results,
    });
  } catch (error) {
    console.error('Microchip report error:', error);
    return NextResponse.json(
      { error: 'Failed to report found microchip' },
      { status: 500 }
    );
  }
}
