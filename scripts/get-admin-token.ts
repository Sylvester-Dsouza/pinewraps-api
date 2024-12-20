import { auth } from '../src/lib/firebase-admin';

async function getAdminToken() {
  try {
    // Create a custom token for the admin user
    const customToken = await auth.createCustomToken('admin');
    console.log('Custom Token:', customToken);

    // You can now use this custom token to get an ID token by:
    // 1. Opening the admin panel
    // 2. In browser console, run:
    /*
      const auth = firebase.auth();
      await auth.signInWithCustomToken('YOUR_CUSTOM_TOKEN');
      const idToken = await auth.currentUser.getIdToken();
      console.log('ID Token:', idToken);
    */
  } catch (error) {
    console.error('Error:', error);
  }
}

getAdminToken();
