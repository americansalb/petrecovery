import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  INSURANCE_PROVIDERS,
  checkInsuranceCoverage,
  submitInsuranceClaim,
  generateVerificationDocument,
  trackClaimStatus,
  calculateClaimEstimate,
} from '@/app/lib/insurance/claims';

/**
 * GET /api/insurance/claims
 * Get insurance info or claim status
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'providers';

    switch (action) {
      case 'providers':
        return NextResponse.json({ providers: INSURANCE_PROVIDERS });

      case 'coverage':
        const coverage = await checkInsuranceCoverage({
          policyNumber: searchParams.get('policyNumber'),
          provider: searchParams.get('provider'),
          petId: searchParams.get('petId'),
        });
        return NextResponse.json(coverage);

      case 'status':
        const status = await trackClaimStatus(
          searchParams.get('claimId'),
          searchParams.get('provider')
        );
        return NextResponse.json(status);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Insurance API error:', error);
    return NextResponse.json(
      { error: 'Query failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/insurance/claims
 * Submit claim or generate documents
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
      case 'submit':
        const claim = await submitInsuranceClaim(body.claimData);
        return NextResponse.json(claim);

      case 'document':
        const document = await generateVerificationDocument(
          body.caseId,
          body.documentType
        );
        return NextResponse.json(document);

      case 'estimate':
        const estimate = await calculateClaimEstimate(
          body.caseId,
          body.expenses
        );
        return NextResponse.json(estimate);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Insurance action error:', error);
    return NextResponse.json(
      { error: 'Action failed' },
      { status: 500 }
    );
  }
}
