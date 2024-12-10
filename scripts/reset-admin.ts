import { PrismaClient } from '@prisma/client';
import { auth } from '../src/lib/firebase-admin';

const prisma = new PrismaClient();

async function resetAdmin() {
  try {
    // Delete existing super admin from database
    await prisma.user.deleteMany({
      where: {
        role: 'SUPER_ADMIN'
      }
    });
    
    console.log('Deleted existing super admin from database');

    // Try to delete from Firebase if exists
    try {
      const firebaseUser = await auth.getUserByEmail('super@pinewraps.com');
      if (firebaseUser) {
        await auth.deleteUser(firebaseUser.uid);
        console.log('Deleted existing super admin from Firebase');
      }
    } catch (error) {
      // Ignore if user doesn't exist in Firebase
      console.log('No existing super admin in Firebase');
    }

    console.log('Successfully reset admin user');
  } catch (error) {
    console.error('Error resetting admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdmin();
