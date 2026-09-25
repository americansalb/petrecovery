/**
 * GET  /api/geo/admin/reports
 * POST /api/geo/admin/reports   { language, kind }
 *
 * What players said was wrong on Script answer screens, piled up by
 * language and by kind, biggest pile first (server/reports.js). POST
 * marks one pile dealt with once the fix has shipped; anything reported
 * after that starts a new pile.
 */

import { NextResponse } from 'next/server';
import { AdminDenied, requireAdmin } from '@/app/lib/geo/server/admin';
import { closeReports, reportSummary, ReportError } from '@/app/lib/geo/server/reports';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export async function GET(request) {
  try {
    await requireAdmin(request);
    const groups = await reportSummary();
    return NextResponse.json({ groups }, NO_STORE);
  } catch (error) {
    if (error instanceof AdminDenied) return NextResponse.json({ error: error.reason }, { status: 403 });
    console.error('[geo/admin/reports]', error?.message || error);
    return NextResponse.json(schemaErrorBody(error, 'server_error'), { status: 500, ...NO_STORE });
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const closed = await closeReports({ language: body?.language, kind: body?.kind });
    return NextResponse.json({ ok: true, closed }, NO_STORE);
  } catch (error) {
    if (error instanceof AdminDenied) return NextResponse.json({ error: error.reason }, { status: 403 });
    if (error instanceof ReportError) return NextResponse.json({ error: error.code }, { status: 400 });
    console.error('[geo/admin/reports]', error?.message || error);
    return NextResponse.json(schemaErrorBody(error, 'server_error'), { status: 500, ...NO_STORE });
  }
}
