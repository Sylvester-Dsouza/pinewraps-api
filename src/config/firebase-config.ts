import { ServiceAccount } from 'firebase-admin/app';

function validateConfig(): ServiceAccount {
  const config = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    clientId: process.env.FIREBASE_CLIENT_ID,
    authUri: process.env.FIREBASE_AUTH_URI,
    tokenUri: process.env.FIREBASE_TOKEN_URI,
    authProviderX509CertUrl: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    clientX509CertUrl: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  } as ServiceAccount;

  // Validate required fields required
  const requiredFields = ['projectId', 'privateKey', 'clientEmail'] as const;

  for (const field of requiredFields) {
    if (!config[field]) {
      throw new Error(`Missing required Firebase configuration: ${field}`);
    }
  }

  return config;
}

export const firebaseConfig = validateConfig();
