/**
 * Legal Acceptance API
 * Phase 0: Legal Baseline
 *
 * Allows authenticated users to accept legal documents (ToS, Waiver, Privacy Policy).
 * Updates user records and emits structured logging events.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

/**
 * POST /api/legal/accept
 * Body: {
 *   acceptances: [
 *     { documentType: "TERMS_OF_SERVICE", version: "1.0.0" },
 *     { documentType: "LIABILITY_WAIVER", version: "1.0.0" }
 *   ]
 * }
 *
 * Accepts one or more legal documents and updates user records
 */
export async function POST(request) {
  const startTime = Date.now();

  try {
    // ============================================================================
    // AUTHENTICATION CHECK
    // ============================================================================
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      logEvent({
        event_type: 'legal.accept_unauthorized',
        resource_type: 'legal_document',
        action: 'create',
        result: 'failure',
        error_code: 'UNAUTHORIZED',
        error_message: 'User attempted to accept legal documents without authentication',
        metadata: {
          user_agent: request.headers.get('user-agent')
        }
      });

      return NextResponse.json({
        error: 'Unauthorized',
        message: 'You must be logged in to accept legal documents'
      }, { status: 401 });
    }

    console.log(`📄 [Legal Accept] User ${session.user.email} accepting documents`);

    // ============================================================================
    // PARSE REQUEST BODY
    // ============================================================================
    const body = await request.json();
    const { acceptances } = body;

    if (!acceptances || !Array.isArray(acceptances) || acceptances.length === 0) {
      logEvent({
        event_type: 'legal.accept_failed',
        resource_type: 'legal_document',
        action: 'create',
        result: 'failure',
        error_code: 'INVALID_REQUEST',
        error_message: 'No acceptances provided in request body',
        actor_user_id: session.user.id,
        actor_role: session.user.role
      });

      return NextResponse.json({
        error: 'Invalid request',
        message: 'Request must include an array of acceptances'
      }, { status: 400 });
    }

    console.log(`   → Processing ${acceptances.length} document(s)`);

    // ============================================================================
    // VALIDATE & PROCESS EACH ACCEPTANCE
    // ============================================================================

    const acceptedDocuments = [];
    const updateData = {};
    const now = new Date();

    for (const acceptance of acceptances) {
      const { documentType, version } = acceptance;

      // Validate required fields
      if (!documentType || !version) {
        logEvent({
          event_type: 'legal.accept_failed',
          resource_type: 'legal_document',
          action: 'create',
          result: 'failure',
          error_code: 'INVALID_REQUEST',
          error_message: 'Missing documentType or version in acceptance',
          actor_user_id: session.user.id,
          actor_role: session.user.role
        });

        return NextResponse.json({
          error: 'Invalid acceptance',
          message: 'Each acceptance must include documentType and version'
        }, { status: 400 });
      }

      // Validate document type
      const validTypes = ['TERMS_OF_SERVICE', 'LIABILITY_WAIVER', 'PRIVACY_POLICY'];
      if (!validTypes.includes(documentType)) {
        logEvent({
          event_type: 'legal.accept_failed',
          resource_type: 'legal_document',
          action: 'create',
          result: 'failure',
          error_code: 'INVALID_DOCUMENT_TYPE',
          error_message: `Invalid document type: ${documentType}`,
          actor_user_id: session.user.id,
          actor_role: session.user.role,
          metadata: {
            document_type: documentType
          }
        });

        return NextResponse.json({
          error: 'Invalid document type',
          message: `Document type must be one of: ${validTypes.join(', ')}`
        }, { status: 400 });
      }

      // Verify document exists with this version
      const document = await prisma.legalDocument.findFirst({
        where: {
          type: documentType,
          version: version,
          isActive: true
        }
      });

      if (!document) {
        console.log(`   ❌ Document not found: ${documentType} v${version}`);

        logEvent({
          event_type: 'legal.accept_failed',
          resource_type: 'legal_document',
          action: 'create',
          result: 'failure',
          error_code: 'DOCUMENT_NOT_FOUND',
          error_message: `No active document found for type ${documentType} version ${version}`,
          actor_user_id: session.user.id,
          actor_role: session.user.role,
          metadata: {
            document_type: documentType,
            document_version: version
          }
        });

        return NextResponse.json({
          error: 'Document not found',
          message: `No active document found for ${documentType} version ${version}`
        }, { status: 400 });
      }

      console.log(`   ✅ Validated: ${document.title} v${version}`);

      // Build update data for user model
      if (documentType === 'TERMS_OF_SERVICE') {
        updateData.tosAcceptedAt = now;
        updateData.tosVersionAccepted = version;
      } else if (documentType === 'LIABILITY_WAIVER') {
        updateData.waiverAcceptedAt = now;
        updateData.waiverVersionAccepted = version;
      }
      // Note: Privacy Policy acceptance tracked via ToS for v1

      acceptedDocuments.push({
        type: documentType,
        version: version,
        acceptedAt: now.toISOString(),
        documentId: document.id
      });
    }

    // ============================================================================
    // UPDATE USER RECORDS
    // ============================================================================

    console.log('   → Updating user legal acceptance records...');

    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData
    });

    console.log('   ✅ User records updated');

    // ============================================================================
    // EVENT LOGGING
    // ============================================================================

    // Log acceptance event for each document
    for (const accepted of acceptedDocuments) {
      logEvent({
        event_type: 'legal.accepted',
        resource_type: 'legal_document',
        resource_id: accepted.documentId,
        action: 'create',
        result: 'success',
        actor_user_id: session.user.id,
        actor_role: session.user.role,
        metadata: {
          document_type: accepted.type,
          document_version: accepted.version,
          user_email: session.user.email,
          acceptance_timestamp: accepted.acceptedAt
        }
      });

      console.log(`   📝 Logged acceptance: ${accepted.type} v${accepted.version}`);
    }

    const responseTime = Date.now() - startTime;

    console.log(`✅ [Legal Accept] Completed in ${responseTime}ms`);

    // ============================================================================
    // RESPONSE
    // ============================================================================

    return NextResponse.json({
      success: true,
      message: 'Legal documents accepted successfully',
      accepted: acceptedDocuments.map(({ documentId, ...rest }) => rest), // Don't expose internal IDs
      response_time_ms: responseTime
    });

  } catch (error) {
    console.error('❌ [Legal Accept] Unexpected error:', error);

    logEvent({
      event_type: 'legal.accept_failed',
      resource_type: 'legal_document',
      action: 'create',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || null,
      metadata: {
        error_stack: error.stack?.substring(0, 500)
      }
    });

    return NextResponse.json({
      error: 'Failed to accept documents',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/legal/accept
 * The signed-in user's standing vs the active documents, so surfaces
 * like the Health Book can ask "has this person agreed to the current
 * Terms?" and show a calm one-time agree card when they haven't.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [user, activeTos] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { tosAcceptedAt: true, tosVersionAccepted: true },
      }),
      prisma.legalDocument.findFirst({
        where: { type: 'TERMS_OF_SERVICE', isActive: true },
        select: { version: true, title: true },
      }),
    ]);

    return NextResponse.json({
      termsOfService: {
        activeVersion: activeTos?.version || null,
        acceptedVersion: user?.tosVersionAccepted || null,
        current: !!activeTos && user?.tosVersionAccepted === activeTos.version,
      },
    });
  } catch (error) {
    console.error('[Legal Accept] status failed:', error);
    return NextResponse.json({ error: 'Failed to load acceptance status' }, { status: 500 });
  }
}
