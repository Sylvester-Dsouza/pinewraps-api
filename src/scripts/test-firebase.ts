import { auth, admin } from '../config/firebase-config';

async function testFirebaseConfig() {
  try {
    console.log('Testing Firebase Admin SDK configuration...');

    // Test Firebase Admin initialization
    console.log('1. Testing Firebase Admin initialization...');
    if (!admin.apps.length) {
      throw new Error('Firebase Admin SDK not initialized');
    }
    console.log('✓ Firebase Admin SDK initialized successfully');

    // Test Auth service
    console.log('\n2. Testing Auth service...');
    const listUsers = await auth.listUsers(1);
    console.log('✓ Auth service working - Successfully listed users');

    // Test custom claims
    console.log('\n3. Testing custom claims...');
    const customClaims = {
      admin: true,
      accessLevel: 2
    };
    
    // Create a test user if needed
    let testUser;
    try {
      testUser = await auth.getUserByEmail('test@example.com');
    } catch (error) {
      testUser = await auth.createUser({
        email: 'test@example.com',
        password: 'testpassword123'
      });
      console.log('Created test user');
    }

    await auth.setCustomUserClaims(testUser.uid, customClaims);
    const userRecord = await auth.getUser(testUser.uid);
    console.log('✓ Custom claims set successfully:', userRecord.customClaims);

    console.log('\n✅ All Firebase tests passed successfully!');
  } catch (error: any) {
    console.error('\n❌ Firebase test failed:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Run the test
testFirebaseConfig();
