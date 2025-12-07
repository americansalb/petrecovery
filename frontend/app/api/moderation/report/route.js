import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { reportContent } from '@/app/lib/moderation';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contentType, contentId, reason, details } = await request.json();

    if (!contentType || !contentId || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const report = await reportContent({
      reporterId: session.user.id,
      contentType,
      contentId,
      reason,
      details,
    });

    return NextResponse.json({
      success: true,
      reportId: report.id,
      message: 'Report submitted. Our team will review it shortly.',
    });
  } catch (error) {
    console.error('Report error:', error);
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
  }
}
