const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Deleting all rescue squad members...');
  await prisma.rescueSquadMember.deleteMany({});
  console.log('Deleting all rescue squads...');
  await prisma.rescueSquad.deleteMany({});
  console.log('Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
