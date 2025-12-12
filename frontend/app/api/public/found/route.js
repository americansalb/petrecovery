/**
 * Public Found Pet Report API - DEPRECATED
 *
 * This endpoint has been deprecated. Please use:
 * - POST /api/reports/create with reportType: 'FOUND' for reporting found pets
 * - GET /api/missions with type=FOUND for listing found pet reports
 */

import { NextResponse } from 'next/server';

export async function GET(request) {
  return NextResponse.json({
    error: 'This endpoint has been deprecated',
    message: 'Please use GET /api/missions?type=FOUND to list found pet reports',
    deprecatedAt: '2024-01-01'
  }, { status: 410 }); // 410 Gone
}

export async function POST(request) {
  return NextResponse.json({
    error: 'This endpoint has been deprecated',
    message: 'Please use POST /api/reports/create to submit found pet reports',
    deprecatedAt: '2024-01-01'
  }, { status: 410 }); // 410 Gone
}
