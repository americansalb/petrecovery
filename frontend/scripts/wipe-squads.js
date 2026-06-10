const path = require('path');
const prismaPath = path.join(__dirname, '../app/lib/prisma.js');
const prisma = require(prismaPath).default;

async function wipeSquads() {
  try {
    console.log('🗑️  Starting to wipe all rescue force data...');

    // Delete all case participants first (to avoid constraint issues)
    const participants = await prisma.caseParticipant.deleteMany({
      where: {
        assignment: {
          rescueSquadId: { not: null }
        }
      }
    });
    console.log(`✅ Deleted ${participants.count} case participants`);

    // Delete all case assignments
    const assignments = await prisma.caseAssignment.deleteMany({});
    console.log(`✅ Deleted ${assignments.count} case assignments`);

    // Delete all squad members
    const members = await prisma.rescueForceMember.deleteMany({});
    console.log(`✅ Deleted ${members.count} squad members`);

    // Delete all divisions
    const divisions = await prisma.division.deleteMany({});
    console.log(`✅ Deleted ${divisions.count} divisions`);

    // Finally, delete all rescue forces
    const squads = await prisma.rescueForce.deleteMany({});
    console.log(`✅ Deleted ${squads.count} rescue forces`);

    console.log('\n🎉 All rescue force data wiped successfully!');
    console.log('You can now create new squads with proper coordinates.');

  } catch (error) {
    console.error('❌ Error wiping squads:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

wipeSquads();
