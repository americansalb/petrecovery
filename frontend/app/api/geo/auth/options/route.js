import { NextResponse } from 'next/server';
import { phoneSignInConfigured } from '@/app/lib/geo/server/phoneAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ phone: phoneSignInConfigured() }, { headers: { 'Cache-Control': 'no-store' } });
}
