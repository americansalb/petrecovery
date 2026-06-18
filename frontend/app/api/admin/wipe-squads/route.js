import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { isAdmin } from '@/app/lib/authz';

// POST /api/admin/wipe-squads - Delete all rescue force data (ADMIN ONLY)
export async function POST(request) {
  const timestamp = new Date().toISOString();
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🗑️  [${timestamp}] WIPE SQUADS REQUEST STARTED`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    // Step 1: Check authentication
    console.log('📋 Step 1: Checking authentication...');
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log('❌ Authentication failed - no session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // This irreversibly deletes ALL squads/members/divisions/assignments, so it
    // MUST be admin-gated in-handler (fresh role), never session-only.
    if (!(await isAdmin(session.user.id))) {
      console.log('❌ Forbidden - not an admin');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.log(`✅ Authenticated as admin: ${session.user?.email || session.user?.id}`);

    // Destructive tool — off by default so the entire rescue-force dataset can't
    // be wiped in production (even by an admin) by accident or a stray click.
    // Set ENABLE_ADMIN_MAINTENANCE=true to run intentionally.
    if (process.env.ENABLE_ADMIN_MAINTENANCE !== 'true') {
      console.log('❌ Maintenance tools disabled (ENABLE_ADMIN_MAINTENANCE != true)');
      return NextResponse.json(
        { error: 'Maintenance tools are disabled. Set ENABLE_ADMIN_MAINTENANCE=true to enable.' },
        { status: 403 }
      );
    }

    // Step 2: Count existing data
    console.log('\n📊 Step 2: Counting existing data...');
    try {
      const squadCount = await prisma.rescueForce.count();
      const memberCount = await prisma.rescueForceMember.count();
      const assignmentCount = await prisma.caseAssignment.count();
      const divisionCount = await prisma.division.count();

      console.log(`   - Squads: ${squadCount}`);
      console.log(`   - Members: ${memberCount}`);
      console.log(`   - Assignments: ${assignmentCount}`);
      console.log(`   - Divisions: ${divisionCount}`);
    } catch (countError) {
      console.error('❌ Error counting data:', countError);
      throw countError;
    }

    // Step 3: Delete case participants
    console.log('\n🔄 Step 3: Deleting case participants...');
    let participantsResult;
    try {
      // First, get all assignment IDs that belong to rescue forces
      const squadAssignments = await prisma.caseAssignment.findMany({
        select: { id: true }
      });
      console.log(`   Found ${squadAssignments.length} case assignments`);

      if (squadAssignments.length > 0) {
        const assignmentIds = squadAssignments.map(a => a.id);
        participantsResult = await prisma.caseParticipant.deleteMany({
          where: {
            assignmentId: { in: assignmentIds }
          }
        });
        console.log(`✅ Deleted ${participantsResult.count} case participants`);
      } else {
        participantsResult = { count: 0 };
        console.log(`✅ No case participants to delete`);
      }
    } catch (participantsError) {
      console.error('❌ Error deleting participants:', participantsError);
      console.error('   Error details:', {
        name: participantsError.name,
        message: participantsError.message,
        code: participantsError.code
      });
      throw participantsError;
    }

    // Step 4: Delete case assignments
    console.log('\n🔄 Step 4: Deleting case assignments...');
    let assignmentsResult;
    try {
      assignmentsResult = await prisma.caseAssignment.deleteMany({});
      console.log(`✅ Deleted ${assignmentsResult.count} case assignments`);
    } catch (assignmentsError) {
      console.error('❌ Error deleting assignments:', assignmentsError);
      console.error('   Error details:', {
        name: assignmentsError.name,
        message: assignmentsError.message,
        code: assignmentsError.code
      });
      throw assignmentsError;
    }

    // Step 5: Delete squad members
    console.log('\n🔄 Step 5: Deleting squad members...');
    let membersResult;
    try {
      membersResult = await prisma.rescueForceMember.deleteMany({});
      console.log(`✅ Deleted ${membersResult.count} squad members`);
    } catch (membersError) {
      console.error('❌ Error deleting members:', membersError);
      console.error('   Error details:', {
        name: membersError.name,
        message: membersError.message,
        code: membersError.code
      });
      throw membersError;
    }

    // Step 6: Delete divisions
    console.log('\n🔄 Step 6: Deleting divisions...');
    let divisionsResult;
    try {
      divisionsResult = await prisma.division.deleteMany({});
      console.log(`✅ Deleted ${divisionsResult.count} divisions`);
    } catch (divisionsError) {
      console.error('❌ Error deleting divisions:', divisionsError);
      console.error('   Error details:', {
        name: divisionsError.name,
        message: divisionsError.message,
        code: divisionsError.code
      });
      throw divisionsError;
    }

    // Step 7: Delete rescue forces
    console.log('\n🔄 Step 7: Deleting rescue forces...');
    let squadsResult;
    try {
      squadsResult = await prisma.rescueForce.deleteMany({});
      console.log(`✅ Deleted ${squadsResult.count} rescue forces`);
    } catch (squadsError) {
      console.error('❌ Error deleting squads:', squadsError);
      console.error('   Error details:', {
        name: squadsError.name,
        message: squadsError.message,
        code: squadsError.code
      });
      throw squadsError;
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('🎉 ALL RESCUE FORCE DATA WIPED SUCCESSFULLY!');
    console.log(`${'='.repeat(80)}\n`);

    const result = {
      success: true,
      message: 'All rescue force data wiped successfully',
      deleted: {
        squads: squadsResult.count,
        members: membersResult.count,
        assignments: assignmentsResult.count,
        participants: participantsResult.count,
        divisions: divisionsResult.count
      }
    };

    console.log('📤 Sending success response:', result);
    return NextResponse.json(result);

  } catch (error) {
    console.error('\n❌❌❌ FATAL ERROR IN WIPE PROCESS ❌❌❌');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error stack:', error.stack);
    console.error(`${'='.repeat(80)}\n`);

    return NextResponse.json(
      {
        error: 'Failed to wipe rescue force data',
        details: error.message,
        code: error.code,
        name: error.name
      },
      { status: 500 }
    );
  }
}
