import { PrismaClient } from '@prisma/client';
import { auth } from '../src/lib/firebase-admin';

const prisma = new PrismaClient();

const SUPER_ADMIN = {
  email: 'admin@pinewraps.com',
  password: 'Admin@123'
};

async function resetSuperAdmin() {
  try {
    console.log('Starting super admin reset...');

    // 1. Delete existing user from Firebase if exists
    try {
      const firebaseUser = await auth.getUserByEmail(SUPER_ADMIN.email);
      await auth.deleteUser(firebaseUser.uid);
      console.log('Deleted existing Firebase user');
    } catch (error: any) {
      if (error?.errorInfo?.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // 2. Delete from Prisma database
    await prisma.user.deleteMany({
      where: { email: SUPER_ADMIN.email }
    });
    console.log('Deleted from database');

    // 3. Create new Firebase user
    const userRecord = await auth.createUser({
      email: SUPER_ADMIN.email,
      password: SUPER_ADMIN.password,
      emailVerified: true
    });
    console.log('Created new Firebase user:', userRecord.uid);

    // 4. Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'SUPER_ADMIN',
      admin: true,
      timestamp: Date.now()
    });
    console.log('Set custom claims');

    // 5. Create in Prisma database
    await prisma.user.create({
      data: {
        id: userRecord.uid,
        email: SUPER_ADMIN.email,
        role: 'SUPER_ADMIN',
        firebaseUid: userRecord.uid,
        isActive: true
      }
    });
    console.log('Created in database');

    console.log('Super admin reset complete!');
    console.log('Email:', SUPER_ADMIN.email);
    console.log('Password:', SUPER_ADMIN.password);
  } catch (error) {
    console.error('Error resetting super admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetSuperAdmin();
