/**
 * Legal Documents API - Individual Document Endpoint
 * Phase 0: Legal Baseline
 *
 * Returns full content of a specific legal document (public access).
 * Slug examples: "terms-of-service", "liability-waiver", "privacy-policy"
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/legal/documents/[slug]
 * Returns full content of a specific document
 */
export async function GET(request, { params }) {
  try {
    const { slug } = params;

    console.log(`📄 [Legal Document] Fetching document: ${slug}`);

    // Fetch specific document by slug
    const document = await prisma.legalDocument.findUnique({
      where: {
        slug: slug
      },
      select: {
        id: true,
        slug: true,
        type: true,
        version: true,
        title: true,
        content: true,
        summary: true,
        publishedAt: true,
        isActive: true, // REQUIRED: checked below (line ~49). Without it the
        // isActive guard reads undefined -> every document 404s as "inactive".
      }
    });

    if (!document) {
      console.log(`❌ [Legal Document] Document not found: ${slug}`);

      return NextResponse.json({
        error: 'Document not found',
        message: `No legal document found with slug: ${slug}`
      }, { status: 404 });
    }

    // Only return active documents (unless it's a legacy version lookup in future)
    if (!document.isActive) {
      console.log(`⚠️  [Legal Document] Document inactive: ${slug}`);

      return NextResponse.json({
        error: 'Document not available',
        message: 'This document version is no longer active'
      }, { status: 404 });
    }

    console.log(`✅ [Legal Document] Retrieved: ${document.title} (v${document.version})`);

    return NextResponse.json(document);

  } catch (error) {
    console.error('❌ [Legal Document] Failed to fetch document:', error);

    return NextResponse.json({
      error: 'Failed to fetch legal document',
      message: error.message
    }, { status: 500 });
  }
}
