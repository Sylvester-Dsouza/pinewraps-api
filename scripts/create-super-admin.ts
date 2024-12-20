import { auth } from '../src/lib/firebase-admin';
import { prisma } from '../src/lib/prisma';
import { UserRole, AdminAccess } from '@prisma/client';

const SUPER_ADMIN = {
  email: 'admin@pinewraps.com',
  password: 'Admin@123'
};

async function createSuperAdmin() {
  try {
    console.log('Creating super admin...');

    // Delete existing user if exists
    try {
      const existingUser = await auth.getUserByEmail(SUPER_ADMIN.email);
      await auth.deleteUser(existingUser.uid);
      console.log('Deleted existing Firebase user');
    } catch (error: any) {
      if (error?.errorInfo?.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Delete from database if exists
    await prisma.user.deleteMany({
      where: { email: SUPER_ADMIN.email }
    });
    console.log('Deleted from database if existed');

    // Create Firebase user
    const userRecord = await auth.createUser({
      email: SUPER_ADMIN.email,
      password: SUPER_ADMIN.password,
      emailVerified: true
    });
    console.log('Created Firebase user:', userRecord.uid);

    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      superAdmin: true,
      role: UserRole.SUPER_ADMIN
    });
    console.log('Set custom claims');

    // Create in database
    const user = await prisma.user.create({
      data: {
        email: SUPER_ADMIN.email,
        firebaseUid: userRecord.uid,
        role: UserRole.SUPER_ADMIN,
        adminAccess: Object.values(AdminAccess),
        isActive: true
      }
    });
    console.log('Created in database:', user.id);

    console.log('\nSuper admin created successfully!');
    console.log('Email:', SUPER_ADMIN.email);
    console.log('Password:', SUPER_ADMIN.password);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();
