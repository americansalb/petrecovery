/**
 * Pet Sharing API
 *
 * GET  /api/pets/[id]/shares - List who a pet is shared with (owner only)
 * POST /api/pets/[id]/shares - Invite someone by email (owner only)
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requirePetOwner } from '@/app/lib/petOwnership';
import { sendEmail, renderBrandedEmail, escapeHtml } from '@/app/lib/email';
import { getEmailBaseUrl } from '@/app/lib/config';
import { withRateLimitAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { logEvent } from '@/lib/logging';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SHARES_PER_PET = 10;

const shareSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  respondedAt: true,
  user: { select: { id: true, firstName: true, lastName: true, profileImage: true } },
};

// GET /api/pets/[id]/shares
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetOwner(id);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const shares = await prisma.petShare.findMany({
      where: { petId: id },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }], // ACTIVE first
      select: shareSelect,
    });

    return NextResponse.json({ pet: auth.pet, shares });
  } catch (error) {
    console.error('[SHARES API] Error listing shares:', error);
    return NextResponse.json({ error: 'Failed to load sharing' }, { status: 500 });
  }
}

// POST /api/pets/[id]/shares
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetOwner(id);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // Each invite sends a domain-authenticated email to an attacker-chosen
    // address, so throttle even though the caller is an authenticated owner.
    const rl = await withRateLimitAsync(request, RateLimitPresets.PUBLIC_WRITE, 'pet:share-invite');
    if (!rl.success) return rateLimitResponse(rl);

    const body = await request.json().catch(() => ({}));
    const email = (body.email || '').toLowerCase().trim();
    const role = body.role === 'VIEWER' ? 'VIEWER' : 'CAREGIVER';

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }
    if (email === auth.user.email) {
      return NextResponse.json({ error: "That's you — you already have full access" }, { status: 400 });
    }

    // Only owner-initiated shares count against the cap. Inbound join REQUESTED
    // rows are not shares the owner chose to grant, so counting them would let a
    // stranger spamming join requests lock the owner out of inviting anyone.
    const count = await prisma.petShare.count({ where: { petId: id, status: { not: 'REQUESTED' } } });
    if (count >= MAX_SHARES_PER_PET) {
      return NextResponse.json({ error: `A pet can be shared with up to ${MAX_SHARES_PER_PET} people` }, { status: 400 });
    }

    const existing = await prisma.petShare.findUnique({
      where: { petId_email: { petId: id, email } },
    });
    if (existing) {
      return NextResponse.json(
        { error: existing.status === 'ACTIVE' ? 'Already shared with that email' : 'An invite for that email is already pending' },
        { status: 409 }
      );
    }

    // Link immediately if they already have an account (status stays PENDING
    // until they accept — access is never granted silently).
    const invitee = await prisma.user.findUnique({
      where: { email },
      select: { id: true, firstName: true },
    });

    const share = await prisma.petShare.create({
      data: {
        petId: id,
        email,
        userId: invitee?.id || null,
        role,
        invitedById: auth.user.id,
      },
      select: shareSelect,
    });

    // Fire-and-forget notification — sharing works even with email unconfigured.
    const inviter = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { firstName: true },
    });
    const baseUrl = getEmailBaseUrl();
    const inviterName = inviter?.firstName || 'A pet owner';
    // Escape every user-controlled value that lands in bodyHtml. The pet name,
    // the inviter's name, and even the invitee email (EMAIL_REGEX admits < > "
    // since they are neither whitespace nor @) are attacker-influenced and go
    // to an arbitrary address, so an unescaped one turns this into a phishing
    // relay. heading/preheader/footnote are escaped inside renderBrandedEmail.
    const petNameSafe = escapeHtml(auth.pet.name);
    const inviterNameSafe = escapeHtml(inviterName);
    const emailSafe = escapeHtml(email);
    const roleLine = role === 'CAREGIVER'
      ? `You'll be able to see ${petNameSafe}'s profile, track their medications, and check off doses.`
      : `You'll be able to see ${petNameSafe}'s profile and medication schedule.`;

    // Smart routing: existing accounts go to sign-in, new people go to the
    // signup wizard, both with the email prefilled and landing on My Pets.
    const ctaUrl = invitee
      ? `${baseUrl}/login?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent('/pets')}`
      : `${baseUrl}/register?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent('/pets')}`;
    const ctaLabel = invitee ? 'Sign in to accept' : 'Create my free account';

    sendEmail({
      to: email,
      subject: `${inviterName} shared ${auth.pet.name} with you on ReunitePets`,
      html: renderBrandedEmail({
        preheader: `${inviterName} invited you to help care for ${auth.pet.name}.`,
        heading: `${inviterName} shared ${auth.pet.name} with you`,
        bodyHtml: `
          <p style="margin:0 0 16px;">${inviterNameSafe} invited you to join <strong>${petNameSafe}</strong>'s care team as a <strong>${role === 'CAREGIVER' ? 'caregiver' : 'viewer'}</strong>.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
            <tr>
              <td style="background-color:#fefce8; border:1px solid #fde047; border-radius:12px; padding:16px 20px; font-size:15px; color:#334155;">
                ${roleLine}
              </td>
            </tr>
          </table>
          ${invitee ? '' : `<p style="margin:16px 0 0; font-size:14px; color:#64748b;">Sign up with this email address (<strong>${emailSafe}</strong>) and the invite will be waiting for you.</p>`}
        `,
        ctaLabel,
        ctaUrl,
        footnote: `You received this because ${inviterName} entered your email on ReunitePets. Not expecting it? Just ignore this message.`,
      }),
    }).catch(() => {});

    logEvent({
      event_type: 'pet.share_created',
      resource_type: 'pet_share',
      resource_id: share.id,
      action: 'create',
      result: 'success',
      actor_user_id: auth.user.id,
      metadata: { petId: id, role, inviteeExists: Boolean(invitee) },
    }).catch(() => {});

    return NextResponse.json({ share, message: `Invite sent to ${email}` }, { status: 201 });
  } catch (error) {
    console.error('[SHARES API] Error creating share:', error);
    return NextResponse.json({ error: 'Failed to share pet' }, { status: 500 });
  }
}
