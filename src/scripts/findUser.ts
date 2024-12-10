import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function findUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@pinewraps.com' }
    });

    console.log('Found user:', user);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findUser();
