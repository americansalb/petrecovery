import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/unsubscribe/:token
 *
 * Handle email unsubscribe via token.
 * This is a public endpoint for one-click unsubscribe.
 */
export async function GET(request, { params }) {
  try {
    const { token } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // Optional: specific email type to unsubscribe from

    if (!token) {
      return NextResponse.json(
        { error: 'Invalid unsubscribe token' },
        { status: 400 }
      );
    }

    // Find the email preference by unsubscribe token
    const preference = await prisma.emailPreference.findUnique({
      where: { unsubscribeToken: token }
    });

    if (!preference) {
      return NextResponse.json(
        { error: 'Invalid or expired unsubscribe link' },
        { status: 404 }
      );
    }

    // Update preferences based on type or unsubscribe from all
    const updateData = {};

    if (type) {
      // Unsubscribe from specific type
      switch (type) {
        case 'case_updates':
          updateData.caseUpdates = false;
          break;
        case 'sighting_alerts':
          updateData.sightingAlerts = false;
          break;
        case 'squad_messages':
          updateData.squadMessages = false;
          break;
        case 'weekly_digest':
          updateData.weeklyDigest = false;
          break;
        case 'marketing':
          updateData.marketingEmails = false;
          break;
        default:
          return NextResponse.json(
            { error: 'Invalid email type' },
            { status: 400 }
          );
      }
    } else {
      // Unsubscribe from all non-essential emails
      updateData.caseUpdates = false;
      updateData.sightingAlerts = false;
      updateData.squadMessages = false;
      updateData.weeklyDigest = false;
      updateData.marketingEmails = false;
      // Keep system announcements on
    }

    updateData.unsubscribedAt = new Date();

    await prisma.emailPreference.update({
      where: { id: preference.id },
      data: updateData
    });

    // Redirect to unsubscribe confirmation page
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://petrecovery.org';
    return NextResponse.redirect(`${baseUrl}/unsubscribe/success?type=${type || 'all'}`);

  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    return NextResponse.json(
      { error: 'Failed to process unsubscribe request' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/unsubscribe/:token
 *
 * Handle unsubscribe with reason.
 */
export async function POST(request, { params }) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { reason, types } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Invalid unsubscribe token' },
        { status: 400 }
      );
    }

    const preference = await prisma.emailPreference.findUnique({
      where: { unsubscribeToken: token }
    });

    if (!preference) {
      return NextResponse.json(
        { error: 'Invalid or expired unsubscribe link' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData = {
      unsubscribedAt: new Date(),
      unsubscribeReason: reason || null
    };

    // If specific types provided, only unsubscribe from those
    if (types && Array.isArray(types)) {
      if (types.includes('case_updates')) updateData.caseUpdates = false;
      if (types.includes('sighting_alerts')) updateData.sightingAlerts = false;
      if (types.includes('squad_messages')) updateData.squadMessages = false;
      if (types.includes('weekly_digest')) updateData.weeklyDigest = false;
      if (types.includes('marketing')) updateData.marketingEmails = false;
    } else {
      // Unsubscribe from all non-essential
      updateData.caseUpdates = false;
      updateData.sightingAlerts = false;
      updateData.squadMessages = false;
      updateData.weeklyDigest = false;
      updateData.marketingEmails = false;
    }

    await prisma.emailPreference.update({
      where: { id: preference.id },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully unsubscribed'
    });

  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    return NextResponse.json(
      { error: 'Failed to process unsubscribe request' },
      { status: 500 }
    );
  }
}
