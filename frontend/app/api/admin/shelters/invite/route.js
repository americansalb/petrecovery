/**
 * Admin Shelter Invite API
 *
 * POST /api/admin/shelters/invite - Invite a shelter to join
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { sendEmail } from '@/app/lib/email';
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
    const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create shelter record (inactive until claimed)
    const shelter = await prisma.shelter.create({
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

    // Store invite token in shelter profile
    await prisma.shelterProfile.create({
      data: {
        shelterId: shelter.id,
        // Store invite data temporarily
        about: JSON.stringify({
          inviteToken,
          inviteExpiry: inviteExpiry.toISOString(),
          invitedBy: admin.id,
          invitedAt: new Date().toISOString(),
        }),
      }
    });

    // Send invite email
    const inviteUrl = `${process.env.NEXTAUTH_URL}/shelter/claim?token=${inviteToken}&id=${shelter.id}`;

    await sendEmail({
      to: shelterEmail,
      subject: `You're invited to join ReunitePets.org - ${shelterName}`,
      html: `
        <h2>Welcome to ReunitePets!</h2>
        <p>Hi ${contactName || 'there'},</p>
        <p>You've been invited to create a shelter account for <strong>${shelterName}</strong> on ReunitePets.org.</p>
        ${message ? `<p><em>"${message}"</em></p>` : ''}
        <p>With your free shelter account, you can:</p>
        <ul>
          <li>List animals available for adoption</li>
          <li>Get automatically matched with lost pet reports</li>
          <li>Accept donations (no platform fees)</li>
          <li>Connect with the rescue community</li>
        </ul>
        <p><a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px;">Accept Invitation</a></p>
        <p style="color: #666; font-size: 14px;">This invitation expires in 7 days.</p>
        <p>Questions? Just reply to this email.</p>
      `,
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
