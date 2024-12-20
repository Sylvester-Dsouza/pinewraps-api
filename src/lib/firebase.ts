import { initializeApp, cert, ServiceAccount, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { firebaseConfig } from '../config/firebase-config.js';

// The correct bucket name format is: project-id.firebasestorage.app
const BUCKET_NAME = "pinewraps-23e8a.firebasestorage.app";

// Initialize Firebase Admin SDK
let app;
try {
  if (getApps().length === 0) {
    console.log('Initializing Firebase Admin SDK...');
    app = initializeApp({
      credential: cert(firebaseConfig as ServiceAccount),
      storageBucket: BUCKET_NAME
    });
    console.log('Firebase Admin SDK initialized successfully');
  } else {
    console.log('Firebase Admin SDK already initialized');
    app = getApps()[0];
  }
} catch (error) {
  console.error('Error initializing Firebase:', error);
  throw error;
}

// Initialize services
export const auth = getAuth(app);
export const storage = getStorage(app);
export const bucket = storage.bucket(BUCKET_NAME);

// Helper functions for authentication
export async function verifyToken(token: string) {
  try {
    console.log('Verifying token...');
    const decodedToken = await auth.verifyIdToken(token);
    console.log('Token verified successfully');
    return decodedToken;
  } catch (error) {
    console.error('Error verifying token:', error);
    throw error;
  }
}

// Check if user is admin
export async function isAdmin(uid: string) {
  try {
    console.log('Checking admin status for uid:', uid);
    const user = await auth.getUser(uid);
    const isAdmin = user.customClaims?.admin === true;
    console.log('User admin status:', isAdmin);
    return isAdmin;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

// Set admin claim for a user
export async function setAdminClaim(uid: string) {
  try {
    await auth.setCustomUserClaims(uid, { admin: true });
    console.log('Admin claim set successfully for uid:', uid);
    return true;
  } catch (error) {
    console.error('Error setting admin claim:', error);
    return false;
  }
}

// Helper functions for storage
export async function uploadFile(file: Buffer, path: string) {
  try {
    const fileBuffer = Buffer.from(file);
    const blob = bucket.file(path);
    await blob.save(fileBuffer);
    return blob.publicUrl();
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

export async function deleteFile(path: string) {
  try {
    await bucket.file(path).delete();
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}
