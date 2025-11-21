import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getServerSession } from 'next-auth';

export async function POST(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reportId } = await request.json();

    if (!reportId) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 });
    }

    // Get the current user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the case and verify ownership
    const caseRecord = await prisma.case.findUnique({
      where: { id: reportId },
    });

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (caseRecord.reporterId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to update this case' }, { status: 403 });
    }

    // Update the case status to REUNITED
    await prisma.case.update({
      where: { id: reportId },
      data: {
        status: 'REUNITED',
        resolvedAt: new Date(),
      }
    });

    return NextResponse.json({
      success: true,
      message: `${caseRecord.petName} marked as found! 🎉`
    });

  } catch (error) {
    console.error('❌ Mark as found error:', error);
    return NextResponse.json(
      { error: 'Failed to mark report as found', details: error.message },
      { status: 500 }
    );
  }
}
