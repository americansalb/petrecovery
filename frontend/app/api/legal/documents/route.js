/**
 * Legal Documents API - List Endpoint
 * Phase 0: Legal Baseline
 *
 * Returns all active legal documents (public access).
 * Documents are ordered by type: ToS, Waiver, Privacy Policy
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/legal/documents
 * Returns all active legal documents
 */
export async function GET(request) {
  try {
    console.log('📄 [Legal Documents] Fetching all active documents');

    // Fetch all active documents
    const documents = await prisma.legalDocument.findMany({
      where: { isActive: true },
      select: {
        id: true,
        slug: true,
        type: true,
        version: true,
        title: true,
        summary: true,
        publishedAt: true,
      },
      orderBy: [
        { type: 'asc' }, // Order: TERMS_OF_SERVICE, LIABILITY_WAIVER, PRIVACY_POLICY
        { publishedAt: 'desc' }
      ]
    });

    console.log(`✅ [Legal Documents] Found ${documents.length} active documents`);

    return NextResponse.json({
      documents: documents
    });

  } catch (error) {
    console.error('❌ [Legal Documents] Failed to fetch documents:', error);

    return NextResponse.json({
      error: 'Failed to fetch legal documents',
      message: error.message
    }, { status: 500 });
  }
}
