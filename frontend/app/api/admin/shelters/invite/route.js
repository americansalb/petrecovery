/**
 * Admin Shelter Invite API
 *
 * POST /api/admin/shelters/invite - invite a shelter to claim its free
 * account. Creates an inactive Shelter + a one-time claim token stored
 * on ShelterProfile (proper columns, 7-day expiry) and emails a branded
 * link to /shelter/claim. Accepting activates the shelter immediately
 * (admin outreach IS the review).
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { sendEmail, renderBrandedEmail, escapeHtml } from '@/app/lib/email';
import { getEmailBaseUrl } from '@/app/lib/config';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      shelterName,
      shelterEmail,
      contactName,
      city,
      state,
      message, // Custom message from admin
    } = body;

    if (!shelterName || !shelterEmail || !city || !state) {
      return NextResponse.json(
        { error: 'Shelter name, email, city, and state are required' },
        { status: 400 }
      );
    }

    // Generate invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Reuse an existing unclaimed directory entry when we have one, so
    // outreach doesn't duplicate shelters we already know about.
    let shelter = await prisma.shelter.findFirst({
      where: {
        name: { equals: shelterName, mode: 'insensitive' },
        city: { equals: city, mode: 'insensitive' },
        state: { equals: state, mode: 'insensitive' },
      },
    });
    if (shelter) {
      const existingProfile = await prisma.shelterProfile.findUnique({
        where: { shelterId: shelter.id },
        select: { claimedById: true },
      });
      if (existingProfile?.claimedById) {
        return NextResponse.json(
          { error: 'That shelter is already managed' },
          { status: 409 }
        );
      }
    } else {
      shelter = await prisma.shelter.create({
        data: {
          name: shelterName,
          email: shelterEmail,
          city,
          state,
          address: '',
          zipCode: '',
          type: 'SHELTER',
          source: 'ADMIN_INVITE',
          isActive: false,
          isVerified: false,
        }
      });
    }

    await prisma.shelterProfile.upsert({
      where: { shelterId: shelter.id },
      create: {
        shelterId: shelter.id,
        inviteToken,
        inviteEmail: shelterEmail.toLowerCase(),
        inviteExpiresAt,
      },
      update: {
        inviteToken,
        inviteEmail: shelterEmail.toLowerCase(),
        inviteExpiresAt,
      },
    });

    const claimUrl = `${getEmailBaseUrl()}/shelter/claim?token=${inviteToken}`;

    await sendEmail({
      to: shelterEmail,
      subject: `Your free shelter account for ${shelterName} is ready to claim`,
      html: renderBrandedEmail({
        preheader: `Claim ${shelterName}'s free account on ReunitePets: animal management, lost-pet matching, and your own page.`,
        heading: `${shelterName}, your free account is waiting`,
        bodyHtml: `<p>Hi ${escapeHtml(contactName || 'there')},</p><p>ReunitePets gives shelters free pet-management accounts: a health record for every animal in your care, automatic matching of strays against local lost-pet reports, adoption handoffs that send the full medical history home with the adopter, staff seats for your team, and a public page for your adoptable animals.</p>${message ? `<p><em>"${escapeHtml(message)}"</em></p>` : ''}<p>Claiming takes about a minute. Free forever, no card, no catch.</p>`,
        ctaLabel: 'Claim your shelter account',
        ctaUrl: claimUrl,
        footnote: `This invite was sent to ${shelterEmail} and expires in 7 days. Questions? Just reply to this email.`,
      }),
    });

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${shelterEmail}`,
      shelter: {
        id: shelter.id,
        name: shelter.name,
      },
    });
  } catch (error) {
    console.error('Error inviting shelter:', error);
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    );
  }
}
