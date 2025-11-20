import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// POST /api/admin/wipe-squads - Delete all rescue squad data (ADMIN ONLY)
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🗑️  Starting to wipe all rescue squad data...');

    // Count before deletion
    const squadCount = await prisma.rescueSquad.count();
    console.log(`Found ${squadCount} squads to delete`);

    // Delete all case participants first (to avoid constraint issues)
    const participantsResult = await prisma.caseParticipant.deleteMany({
      where: {
        assignment: {
          rescueSquadId: { not: null }
        }
      }
    });
    console.log(`✅ Deleted ${participantsResult.count} case participants`);

    // Delete all case assignments
    const assignmentsResult = await prisma.caseAssignment.deleteMany({});
    console.log(`✅ Deleted ${assignmentsResult.count} case assignments`);

    // Delete all squad members
    const membersResult = await prisma.rescueSquadMember.deleteMany({});
    console.log(`✅ Deleted ${membersResult.count} squad members`);

    // Delete all divisions
    const divisionsResult = await prisma.division.deleteMany({});
    console.log(`✅ Deleted ${divisionsResult.count} divisions`);

    // Finally, delete all rescue squads
    const squadsResult = await prisma.rescueSquad.deleteMany({});
    console.log(`✅ Deleted ${squadsResult.count} rescue squads`);

    console.log('\n🎉 All rescue squad data wiped successfully!');

    return NextResponse.json({
      success: true,
      message: 'All rescue squad data wiped successfully',
      deleted: {
        squads: squadsResult.count,
        members: membersResult.count,
        assignments: assignmentsResult.count,
        participants: participantsResult.count,
        divisions: divisionsResult.count
      }
    });

  } catch (error) {
    console.error('❌ Error wiping squads:', error);
    return NextResponse.json(
      { error: 'Failed to wipe squad data', details: error.message },
      { status: 500 }
    );
  }
}
