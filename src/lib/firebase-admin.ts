import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { prisma } from './prisma';
import { UserRole, AdminAccess } from '@prisma/client';

// Initialize Firebase Admin
if (!getApps().length) {
  // Get storage bucket from environment variable
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (!storageBucket) {
    throw new Error('FIREBASE_STORAGE_BUCKET environment variable is not set');
  }

  console.log('Initializing Firebase Admin with bucket:', storageBucket);

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: storageBucket.replace(/"/g, '') // Remove any quotes from the value
  });
}

// Export Firebase services
export const auth = getAuth();
export const storage = getStorage();

// Helper function to get storage bucket
export const getBucket = () => {
  try {
    const bucket = storage.bucket();
    if (!bucket) {
      throw new Error('Storage bucket not initialized');
    }
    console.log('Successfully got bucket:', bucket.name);
    return bucket;
  } catch (error) {
    console.error('Error getting storage bucket:', error);
    throw error;
  }
};

export const setUserClaims = async (
  uid: string, 
  role: UserRole, 
  access?: AdminAccess[]
) => {
  await auth.setCustomUserClaims(uid, {
    role,
    ...(access && { access }),
    timestamp: Date.now()
  });
};

export const initializeSuperAdmin = async (email: string, password: string) => {
  try {
    // Check if super admin exists
    const superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    });

    if (superAdmin) {
      throw new Error('Super admin already exists');
    }

    // Create Firebase user
    const userRecord = await auth.createUser({
      email,
      password,
      emailVerified: true
    });

    // Set super admin claims
    await setUserClaims(userRecord.uid, 'SUPER_ADMIN');

    // Create user in database
    const user = await prisma.user.create({
      data: {
        id: userRecord.uid,
        email,
        role: 'SUPER_ADMIN',
        firebaseUid: userRecord.uid,
        isActive: true
      }
    });

    return user;
  } catch (error) {
    console.error('Error creating super admin:', error);
    throw error;
  }
};

export const createAdminUser = async (
  email: string, 
  password: string, 
  access: AdminAccess[]
) => {
  try {
    // Create Firebase user
    const userRecord = await auth.createUser({
      email,
      password,
      emailVerified: true
    });

    // Set admin claims
    await setUserClaims(userRecord.uid, 'ADMIN', access);

    // Create user in database
    const user = await prisma.user.create({
      data: {
        id: userRecord.uid,
        email,
        role: 'ADMIN',
        adminAccess: access,
        firebaseUid: userRecord.uid,
        isActive: true
      }
    });

    return user;
  } catch (error) {
    console.error('Error creating admin user:', error);
    throw error;
  }
};
