/**
 * The shelter's public page content (about/mission/images/socials).
 *
 * GET   /api/shelter/profile - current values for the caller's shelter
 * PATCH /api/shelter/profile - update (any team member)
 *
 * Image URLs must be https on our own CDN host (the analyze-pet
 * allowlist) so the public page only ever serves our images; social
 * links are domain-checked. Donation fields are deliberately not
 * writable here (that feature does not exist).
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { getShelterForUser } from '@/app/lib/shelterAuth';
import { validateImageUrl } from '@/app/lib/ai/imageFetch';
import { logEvent } from '@/lib/logging';

const ABOUT_MAX = 4000;
const MISSION_MAX = 300;

const SOCIAL_DOMAINS = {
  facebookUrl: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com'],
  instagramUrl: ['instagram.com', 'www.instagram.com'],
  twitterUrl: ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com'],
};

function validSocialUrl(field, value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return false;
    return SOCIAL_DOMAINS[field].includes(parsed.host.toLowerCase());
  } catch {
    return false;
  }
}

async function requireMembership() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: 'Authentication required', status: 401 };
  const membership = await getShelterForUser(session.user.id, session.user.email);
  if (!membership) return { error: 'You don\'t manage a shelter', status: 403 };
  return { session, membership };
}

export async function GET() {
  try {
    const ctx = await requireMembership();
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const profile = await prisma.shelterProfile.findUnique({
      where: { shelterId: ctx.membership.shelterId },
      select: {
        about: true, mission: true, logoUrl: true, coverPhotoUrl: true,
        facebookUrl: true, instagramUrl: true, twitterUrl: true,
      },
    });
    return NextResponse.json({ shelterId: ctx.membership.shelterId, profile: profile || {} });
  } catch (error) {
    console.error('[SHELTER-PROFILE] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const ctx = await requireMembership();
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const body = await request.json().catch(() => ({}));
    const data = {};

    if (body.about !== undefined) {
      data.about = String(body.about || '').trim().slice(0, ABOUT_MAX) || null;
    }
    if (body.mission !== undefined) {
      data.mission = String(body.mission || '').trim().slice(0, MISSION_MAX) || null;
    }
    for (const field of ['logoUrl', 'coverPhotoUrl']) {
      if (body[field] !== undefined) {
        const value = String(body[field] || '').trim();
        if (!value) {
          data[field] = null;
        } else if (validateImageUrl(value)) {
          data[field] = value;
        } else {
          return NextResponse.json(
            { error: 'Images must be uploaded through ReunitePets' },
            { status: 400 }
          );
        }
      }
    }
    for (const field of Object.keys(SOCIAL_DOMAINS)) {
      if (body[field] !== undefined) {
        const value = String(body[field] || '').trim();
        if (!value) {
          data[field] = null;
        } else if (validSocialUrl(field, value)) {
          data[field] = value;
        } else {
          return NextResponse.json({ error: `Invalid ${field.replace('Url', '')} link` }, { status: 400 });
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    await prisma.shelterProfile.upsert({
      where: { shelterId: ctx.membership.shelterId },
      create: { shelterId: ctx.membership.shelterId, ...data },
      update: data,
    });

    logEvent({
      event_type: 'shelter.profile.updated',
      resource_type: 'shelter',
      resource_id: ctx.membership.shelterId,
      action: 'update',
      result: 'success',
      actor_user_id: ctx.session.user.id,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[SHELTER-PROFILE] PATCH failed:', error);
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
  }
}
