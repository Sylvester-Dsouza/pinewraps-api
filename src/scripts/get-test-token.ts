import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

async function getTestToken() {
  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    // Replace with your test user credentials
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';

    // Sign in
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Get the ID token
    const idToken = await userCredential.user.getIdToken();
    console.log('\nFirebase ID Token:\n', idToken, '\n');
    
    // For easy copying to Postman
    console.log('Authorization header:\n', `Bearer ${idToken}\n`);
    
    process.exit(0);
  } catch (error: any) {
    console.error('Error getting token:', error.message);
    process.exit(1);
  }
}

getTestToken();
