/**
 * GET  /api/geo/shop                       header x-geo-profile
 * POST /api/geo/shop  { action, itemId }   action: buy | equip
 *
 * The cosmetics shop (docs/GEO.md, "Points and cosmetics"): the catalog
 * with what this profile owns, may wear and can afford, the balance,
 * and what is worn. Buying takes points through the ledger and wears
 * the item; equipping wears something already owned or unlocked by
 * rating tier. Needs a profile: the browser gets one on its first game.
 */

import { NextResponse } from 'next/server';
import { RateLimitPresets, rateLimitResponse, withRateLimitAsync } from '@/app/lib/rateLimit';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { subjectsFor } from '@/app/lib/geo/server/meterRequest';
import { ShopError, buyItem, equipItem, shopView } from '@/app/lib/geo/server/points';

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

function noProfile() {
  return NextResponse.json({ error: 'Play a round first. The shop opens once this browser has a profile.', code: 'no_profile' }, { status: 401, ...NO_STORE });
}

export async function GET(request) {
  try {
    const { profile } = await subjectsFor(request);
    if (!profile) return noProfile();
    return NextResponse.json({ ok: true, shop: await shopView(prismaRoomStore, profile) }, NO_STORE);
  } catch (error) {
    console.error('[geo/shop] get', error);
    return NextResponse.json({ error: 'Could not load the shop', code: 'internal' }, { status: 500, ...NO_STORE });
  }
}

export async function POST(request) {
  const limit = await withRateLimitAsync(request, RateLimitPresets.PUBLIC_WRITE, 'geo-shop');
  if (!limit.success) return rateLimitResponse(limit);
  let body = {};
  try {
    body = (await request.json()) || {};
  } catch {
    body = {};
  }
  const action = String(body.action || '');
  const itemId = String(body.itemId || '');
  try {
    const { profile } = await subjectsFor(request);
    if (!profile) return noProfile();
    let shop;
    if (action === 'buy') shop = await buyItem(prismaRoomStore, profile, itemId);
    else if (action === 'equip') shop = await equipItem(prismaRoomStore, profile, itemId);
    else return NextResponse.json({ error: `Unknown action: ${action || '(none)'}`, code: 'unknown_action' }, { status: 400, ...NO_STORE });
    return NextResponse.json({ ok: true, shop }, NO_STORE);
  } catch (error) {
    if (error instanceof ShopError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, ...NO_STORE });
    }
    console.error('[geo/shop] post', error);
    return NextResponse.json({ error: 'Something went wrong in the shop', code: 'internal' }, { status: 500, ...NO_STORE });
  }
}
