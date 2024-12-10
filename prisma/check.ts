import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    const users = await prisma.user.findMany();
    console.log('Users:', users);

    const products = await prisma.product.findMany();
    console.log('Products:', products);

    const categories = await prisma.category.findMany();
    console.log('Categories:', categories);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
