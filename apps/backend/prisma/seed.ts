import 'dotenv/config';
import { createPrismaClient } from '../src/lib/prisma-client-factory';
import { seedDatabase } from './seed-data';

const prisma = createPrismaClient();

async function main() {
  await seedDatabase(prisma);

  console.log('Seed completed');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
