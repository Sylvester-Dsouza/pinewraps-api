import { PrismaClient } from '@prisma/client';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as path from 'path';

const prisma = new PrismaClient();

// Initialize Firebase Admin
const serviceAccount = require(path.resolve(process.cwd(), 'firebase-service-account.json'));

const app = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.appspot.com`
});

const auth = getAuth(app);

async function createAdmin() {
  try {
    const email = 'admin@pinewraps.com';
    const password = 'admin123';

    console.log('Starting admin user creation...');

    // Create or get user in Firebase
    let userRecord;
    try {
      console.log('Creating user in Firebase...');
      userRecord = await auth.createUser({
        email,
        password,
        emailVerified: true
      });
      console.log('Created new user in Firebase:', userRecord.uid);
    } catch (error: any) {
      if (error.code === 'auth/email-already-exists') {
        console.log('User already exists in Firebase, getting user details...');
        userRecord = await auth.getUserByEmail(email);
        
        // Update password in Firebase
        await auth.updateUser(userRecord.uid, {
          password,
          emailVerified: true
        });
        console.log('Updated existing user password:', userRecord.uid);
      } else {
        throw error;
      }
    }

    // Set admin claim
    console.log('Setting admin claim...');
    await auth.setCustomUserClaims(userRecord.uid, { admin: true });
    console.log('Admin claim set successfully');

    // Create or update user in database
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        firebaseUid: userRecord.uid,
        role: 'ADMIN',
        password
      },
      create: {
        email,
        firebaseUid: userRecord.uid,
        role: 'ADMIN',
        password
      }
    });

    console.log('\nAdmin user created/updated successfully!');
    console.log('Database ID:', user.id);
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Please change this password after first login.');

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
