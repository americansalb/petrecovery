/**
 * Search Grid API
 * GET - Get grid status
 * POST - Generate grid / claim cell
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  generateSearchGrid,
  getSuggestedArea,
  claimCell,
  markCellSearched,
  getGridStatus,
} from '@/app/lib/volunteer/searchGrid';

export async function GET(request, { params }) {
  try {
    const { caseId } = params;

    const result = await getGridStatus(caseId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get grid error:', error);
    return NextResponse.json(
      { error: 'Failed to get grid' },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { caseId } = params;
    const body = await request.json();
    const { action, location, cellId, sessionId, result: searchResult } = body;

    const session = await getServerSession();
    const userId = session?.user?.id;

    switch (action) {
      case 'generate':
        const generateResult = await generateSearchGrid(caseId, body.options);
        return NextResponse.json(generateResult);

      case 'suggest':
        if (!location) {
          return NextResponse.json(
            { error: 'Location required' },
            { status: 400 }
          );
        }
        const suggestion = await getSuggestedArea(caseId, location);
        return NextResponse.json(suggestion);

      case 'claim':
        if (!cellId || !userId) {
          return NextResponse.json(
            { error: 'Cell ID and user authentication required' },
            { status: 400 }
          );
        }
        const claimResult = await claimCell(cellId, userId, sessionId);
        return NextResponse.json(claimResult);

      case 'complete':
        if (!cellId || !userId) {
          return NextResponse.json(
            { error: 'Cell ID and user authentication required' },
            { status: 400 }
          );
        }
        const completeResult = await markCellSearched(cellId, userId, searchResult || {});
        return NextResponse.json(completeResult);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Grid action error:', error);
    return NextResponse.json(
      { error: 'Failed to perform grid action' },
      { status: 500 }
    );
  }
}
