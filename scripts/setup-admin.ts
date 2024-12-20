import { auth } from '../src/lib/firebase';
import { prisma } from '../src/lib/prisma';

async function setupAdmin() {
  try {
    // Get the admin user from the database
    const adminUser = await prisma.user.findFirst({
      where: {
        role: 'ADMIN'
      }
    });

    if (!adminUser) {
      console.error('Admin user not found in the database');
      process.exit(1);
    }

    let firebaseUid = adminUser.firebaseUid;
    
    // If Firebase UID is dummy or doesn't exist, create/get Firebase user
    if (!firebaseUid || firebaseUid === 'dummy-firebase-uid') {
      try {
        // First try to get existing user by email
        try {
          const existingUser = await auth.getUserByEmail(adminUser.email);
          firebaseUid = existingUser.uid;
          console.log(`Found existing Firebase user with UID: ${firebaseUid}`);
        } catch (error: any) {
          if (error.code === 'auth/user-not-found') {
            // Create new Firebase user if not found
            const userRecord = await auth.createUser({
              email: adminUser.email,
              emailVerified: true,
              displayName: adminUser.name || 'Admin User',
            });
            
            firebaseUid = userRecord.uid;
            console.log(`Created new Firebase user with UID: ${firebaseUid}`);
          } else {
            throw error;
          }
        }

        // Update the user in our database with the Firebase UID
        await prisma.user.update({
          where: { id: adminUser.id },
          data: { firebaseUid: firebaseUid }
        });
      } catch (error) {
        console.error('Error creating/finding Firebase user:', error);
        process.exit(1);
      }
    }

    // Set custom claims for the admin user
    await auth.setCustomUserClaims(firebaseUid, {
      admin: true
    });

    console.log(`Successfully set admin claims for user with Firebase UID: ${firebaseUid}`);
    process.exit(0);
  } catch (error) {
    console.error('Error setting admin claims:', error);
    process.exit(1);
  }
}

setupAdmin();
