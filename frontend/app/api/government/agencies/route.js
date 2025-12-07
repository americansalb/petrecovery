import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/db';
import {
  syncAnimalControlIntakes,
  queryLicenseDatabase,
  reportStrayToAnimalControl,
  coordinateAcrossJurisdictions,
  checkStrayHoldStatus,
} from '@/app/lib/government/agencies';

/**
 * GET /api/government/agencies
 * Query government agency data
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'license':
        const licenseResults = await queryLicenseDatabase({
          licenseNumber: searchParams.get('licenseNumber'),
          microchipId: searchParams.get('microchipId'),
          ownerName: searchParams.get('ownerName'),
          jurisdiction: searchParams.get('jurisdiction'),
        });
        return NextResponse.json(licenseResults);

      case 'hold_status':
        const holdStatus = await checkStrayHoldStatus(
          searchParams.get('intakeId'),
          searchParams.get('agencyId')
        );
        return NextResponse.json(holdStatus);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Government API error:', error);
    return NextResponse.json(
      { error: 'Query failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/government/agencies
 * Interact with government agencies
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'sync_intakes':
        const syncResult = await syncAnimalControlIntakes(
          body.agencyId,
          { since: body.since }
        );
        return NextResponse.json(syncResult);

      case 'report_stray':
        const report = await reportStrayToAnimalControl(body.reportData);
        return NextResponse.json(report);

      case 'coordinate':
        const coordination = await coordinateAcrossJurisdictions(body.caseData);
        return NextResponse.json(coordination);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Government action error:', error);
    return NextResponse.json(
      { error: 'Action failed' },
      { status: 500 }
    );
  }
}
