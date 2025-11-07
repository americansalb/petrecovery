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

    // Get the report and verify ownership
    const report = await prisma.lostReport.findUnique({
      where: { id: reportId },
      include: { pet: true }
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    if (report.reporterId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to update this report' }, { status: 403 });
    }

    // Update the report status to FOUND
    await prisma.lostReport.update({
      where: { id: reportId },
      data: {
        status: 'FOUND',
        foundAt: new Date(),
      }
    });

    return NextResponse.json({
      success: true,
      message: `${report.pet.name} marked as found! 🎉`
    });

  } catch (error) {
    console.error('❌ Mark as found error:', error);
    return NextResponse.json(
      { error: 'Failed to mark report as found', details: error.message },
      { status: 500 }
    );
  }
}
