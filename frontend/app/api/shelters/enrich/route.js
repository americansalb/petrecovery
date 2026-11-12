import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { isAdmin } from '@/app/lib/authz';
import { onlyText, cut } from '@/app/lib/searchText';
import { safeWebUrl } from '@/app/lib/safeUrl';
import { withRateLimitAsync, rateLimitResponse } from '@/app/lib/rateLimit';

/**
 * POST /api/shelters/enrich
 *
 * Save a shelter's phone, website and hours as the map's own listing gives
 * them. Staff only.
 *
 * The directory at /shelters and the shelter list on a search show these as
 * the number to call and the site to open. This took no sign-in and checked
 * nothing: anyone could change them for any shelter by its id, and one
 * request with a filter in place of an id changed every shelter at once.
 * Nothing on the site sends one. It stays for staff, takes ids as text and
 * nothing else, and keeps only a number a phone can dial, an http(s)
 * address and hours of a sensible length.
 */

const LIMIT = { windowMs: 60 * 1000, maxRequests: 5, blockDurationMs: 5 * 60 * 1000 };
const MAX_SHELTERS = 100;
const HOURS_MAX = 2000;

const idOf = (value) => (typeof value === 'string' && /^[A-Za-z0-9._:-]{1,200}$/.test(value) ? value : null);
/** A phone number as digits and the marks people write between them, or null. */
const phoneOf = (value) => {
  const text = typeof value === 'string' ? cut(onlyText(value).replace(/\s+/g, ' ').trim(), 30) : '';
  return /^[+()\d\s.x-]{7,30}$/i.test(text) && (text.match(/\d/g) || []).length >= 7 ? text : null;
};
/** Hours as a line of text, or as the listing's own object written out; null when there is nothing or too much. */
const hoursOf = (value) => {
  if (value === null || value === undefined || value === '') return null;
  let text = null;
  if (typeof value === 'string') text = onlyText(value).trim();
  else if (typeof value === 'object') {
    try {
      text = JSON.stringify(value);
    } catch {
      text = null;
    }
  }
  return text && text.length <= HOURS_MAX ? text : null;
};

export async function POST(request) {
  try {
    const limited = await withRateLimitAsync(request, LIMIT, 'shelters:enrich');
    if (!limited.success) return rateLimitResponse(limited);

    const session = await getServerSession(authOptions).catch(() => null);
    if (!session?.user?.id) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const sent = await request.json().catch(() => null);
    const shelters = sent && typeof sent === 'object' && !Array.isArray(sent) ? sent.shelters : null;

    if (!Array.isArray(shelters) || shelters.length === 0) {
      return NextResponse.json({ error: 'No shelters provided' }, { status: 400 });
    }
    if (shelters.length > MAX_SHELTERS) {
      return NextResponse.json({ error: `Send ${MAX_SHELTERS} shelters at most.` }, { status: 400 });
    }

    let updatedCount = 0;
    let skippedNoId = 0;
    let skippedNoData = 0;

    for (const shelter of shelters) {
      const row = shelter && typeof shelter === 'object' && !Array.isArray(shelter) ? shelter : {};
      // An id is text. Anything else (a filter that would match many rows, most of all) is no id.
      const id = idOf(row.id);
      const appleMapKitId = idOf(row.appleMapKitId);
      if (!id && !appleMapKitId) {
        skippedNoId++;
        continue;
      }

      const updateData = {};
      const phone = phoneOf(row.phone);
      const website = safeWebUrl(row.website);
      const hours = hoursOf(row.hours);
      if (phone) updateData.phone = phone;
      if (website) updateData.website = website;
      if (hours) updateData.hours = hours;

      if (Object.keys(updateData).length === 0) {
        skippedNoData++;
        continue;
      }

      try {
        // By database id first, then by the map's own id
        if (id) {
          await prisma.shelter.update({ where: { id }, data: updateData });
        } else {
          await prisma.shelter.updateMany({ where: { appleMapKitId }, data: updateData });
        }
        updatedCount++;
      } catch (err) {
        // Skip individual shelter errors - best effort update
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      skippedNoId,
      skippedNoData,
    });
  } catch (error) {
    console.error('[ShelterEnrich] Error:', error);
    // What went wrong is in the log above, and is not sent to whoever asked.
    return NextResponse.json({ error: 'Failed to enrich shelters' }, { status: 500 });
  }
}
