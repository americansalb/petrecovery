/**
 * POST /api/cascade/regenerate?case=<Case.id | Case.caseNumber>
 * POST /api/cascade/regenerate?stale=1[&limit=25][&wait=0]
 *
 * Redraw cascade ASSETS (AI copy + flyers + social cards) with the current
 * renderers, overwriting the stored CDN files. Cascade assets are otherwise
 * frozen at report time, so cases created before a design or copy change
 * keep old artwork forever. `?case=` redraws one case whatever its state;
 * `?stale=1` redraws up to `limit` open cases whose stored flyer carries an
 * older renderer version (app/lib/cascade/render/version.js), newest
 * first, and reports how many are still waiting. With `wait=0` it answers
 * at once and redraws in the background, logging a summary when done.
 * Neither re-sends notifications, emails, or alerts.
 *
 * Auth: the shared secret of /api/cascade/sweep (`x-sweep-secret` header or
 * `Authorization: Bearer`), matched against CASCADE_SWEEP_SECRET; 503 when
 * that is unset. The stale pass alone also accepts `x-kit-refresh-token`,
 * a token that exists only inside this server process: that is how the
 * server redraws every open case by itself after a boot
 * (app/lib/cascade/refreshBoot.js), with or without the secret.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { regenerateCaseAssets, refreshStaleKits, countStaleCases } from '@/app/lib/cascade/refresh';
import { bootRefreshToken } from '@/app/lib/cascade/refreshBoot';
import { RENDERER_VERSION } from '@/app/lib/cascade/render/version';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

function authorized(request) {
  const secret = process.env.CASCADE_SWEEP_SECRET;
  const header = request.headers.get('x-sweep-secret');
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (secret && (header === secret || bearer === secret)) return { ok: true, scope: 'all' };
  const token = request.headers.get('x-kit-refresh-token');
  if (token && token === bootRefreshToken()) return { ok: true, scope: 'stale' };
  return { ok: false, disabled: !secret };
}

export async function POST(request) {
  const auth = authorized(request);
  const params = new URL(request.url).searchParams;
  const stale = Boolean(params.get('stale'));

  if (!auth.ok) {
    if (auth.disabled) return NextResponse.json({ error: 'Regenerate is not configured' }, { status: 503 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.scope === 'stale' && !stale) {
    return NextResponse.json({ error: 'That token only redraws stale kits' }, { status: 403 });
  }

  if (stale) {
    const limit = Math.max(1, Math.min(Number(params.get('limit')) || 25, 200));
    if (params.get('wait') === '0') {
      const count = await countStaleCases();
      if (count > 0) {
        refreshStaleKits({ limit })
          .then((stats) => {
            console.log(
              `[kits] redrew ${stats.redrawn} of ${stats.attempted} in ${Math.round((stats.ms || 0) / 1000)}s` +
                (stats.failed?.length ? `; failed: ${stats.failed.join(', ')}` : '') +
                (stats.remaining ? `; ${stats.remaining} still stale` : '') +
                (stats.stopped ? `; stopped: ${stats.stopped}` : '') +
                (stats.skipped ? `; ${stats.skipped}` : '')
            );
          })
          .catch((err) => console.error('[kits] redraw failed:', String(err?.message || err)));
      } else {
        console.log(`[kits] every open case is drawn with renderer ${RENDERER_VERSION}`);
      }
      return NextResponse.json({ ok: true, started: count > 0, stale: count, version: RENDERER_VERSION }, NO_STORE);
    }
    const stats = await refreshStaleKits({ limit, pauseMs: 2000 });
    return NextResponse.json({ ok: true, ...stats }, NO_STORE);
  }

  const ref = params.get('case');
  if (!ref) return NextResponse.json({ error: 'Missing ?case=<id or caseNumber> or ?stale=1' }, { status: 400 });

  const caseData = await prisma.case.findFirst({
    where: { OR: [{ id: ref }, { caseNumber: ref }] },
    include: { pet: true },
  });
  if (!caseData) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

  const outcome = await regenerateCaseAssets(caseData, { correlationId: `regen-${caseData.caseNumber}` });
  return NextResponse.json({ ok: true, caseNumber: caseData.caseNumber, ...outcome }, NO_STORE);
}
