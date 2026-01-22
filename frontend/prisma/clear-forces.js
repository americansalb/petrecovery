const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Deleting all rescue force members...');
  await prisma.rescueForceMember.deleteMany({});
  console.log('Deleting all rescue forces...');
  await prisma.rescueForce.deleteMany({});
  console.log('Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
