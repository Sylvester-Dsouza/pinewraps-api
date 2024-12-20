import { auth } from '../lib/firebase-admin';
import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import { prisma } from '../lib/prisma';

dotenv.config();

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

async function getIdToken(customToken: string): Promise<string> {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: customToken,
      returnSecureToken: true,
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Failed to get ID token: ${JSON.stringify(data.error)}`);
  }

  return data.idToken;
}

async function createTestOrder(idToken: string, deliveryMethod: 'DELIVERY' | 'PICKUP', email: string) {
  console.log(`Creating order with ${deliveryMethod} method...`);
  const orderResponse = await fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify(
      deliveryMethod === 'DELIVERY' 
      ? {
          email,
          phone: '+971501234567',
          firstName: 'Test',
          lastName: 'User',
          deliveryMethod: 'DELIVERY',
          deliveryDate: '2024-12-20',
          deliveryTimeSlot: '10:00-12:00',
          streetAddress: '123 Test St',
          apartment: 'Apt 1',
          emirate: 'DUBAI',
          city: 'Dubai',
          pincode: '12345',
          items: [{
            name: 'Test Cake',
            price: 100,
            quantity: 1,
            variant: 'REGULAR'
          }],
          subtotal: 100,
          total: 130,
          paymentMethod: 'CREDIT_CARD'
        }
      : {
          email,
          phone: '+971501234567',
          firstName: 'Test',
          lastName: 'User',
          deliveryMethod: 'PICKUP',
          pickupDate: '2024-12-20',
          pickupTimeSlot: '10:00-12:00',
          storeLocation: 'Dubai Mall',
          items: [{
            name: 'Test Cake',
            price: 100,
            quantity: 1,
            variant: 'REGULAR'
          }],
          subtotal: 100,
          total: 100, // No delivery charge for pickup
          paymentMethod: 'CREDIT_CARD'
        }
    )
  });

  const orderData = await orderResponse.json();
  console.log(`${deliveryMethod} order creation response:`, JSON.stringify(orderData, null, 2));

  if (orderData.error) {
    throw new Error(`${deliveryMethod} order creation failed: ${JSON.stringify(orderData.error)}`);
  }

  return orderData;
}

async function testOrderEmail() {
  try {
    // Create a test user
    const email = 'test@example.com';
    const uid = 'test-user-123';

    try {
      // Create user in Firebase if not exists
      await auth.createUser({
        uid,
        email,
        password: 'testpassword123',
        emailVerified: true
      });
      console.log('Created new test user');
    } catch (error: any) {
      if (error.code === 'auth/uid-already-exists') {
        console.log('Test user already exists');
      } else {
        throw error;
      }
    }

    // Set custom claims
    await auth.setCustomUserClaims(uid, {
      role: 'CUSTOMER',
      email,
      customerId: uid
    });
    console.log('Set custom claims');

    // Get user
    const user = await auth.getUser(uid);
    console.log('Got user:', user.email);

    // Check if customer exists
    let customer = await prisma.customer.findUnique({
      where: { email }
    });

    if (customer) {
      console.log('Customer exists, updating...');
      customer = await prisma.customer.update({
        where: { email },
        data: {
          firebaseUid: uid,
          firstName: 'Test',
          lastName: 'User',
          phone: '+971501234567'
        }
      });
    } else {
      console.log('Creating new customer...');
      customer = await prisma.customer.create({
        data: {
          email,
          firebaseUid: uid,
          firstName: 'Test',
          lastName: 'User',
          phone: '+971501234567'
        }
      });
    }

    console.log('Customer:', customer);

    // Get ID token
    const customToken = await auth.createCustomToken(uid);
    console.log('Created custom token');
    const idToken = await getIdToken(customToken);
    console.log('Got ID token');

    // Test delivery order
    await createTestOrder(idToken, 'DELIVERY', email);

    // Test pickup order
    await createTestOrder(idToken, 'PICKUP', email);

  } catch (error) {
    console.error('Test failed:', error);
    if (error instanceof Error && error.cause) {
      console.error('Caused by:', error.cause);
    }
  }
}

testOrderEmail();
