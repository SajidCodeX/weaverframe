import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  await prisma.publicReview.deleteMany({});
  await prisma.reviewRequest.deleteMany({});
  console.log('Cleared all reviews!');
}

run().finally(() => prisma.$disconnect());
