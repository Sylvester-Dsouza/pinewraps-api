import { Request, Response } from 'express';
import { auth } from '../lib/firebase-admin';
import { prisma } from '../lib/prisma';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone, token } = req.body;
    
    if (!email || !firstName || !lastName || !phone || !token) {
      return res.status(400).json({
        error: {
          message: 'Email, firstName, lastName, phone, and token are required'
        }
      });
    }

    // Verify Firebase token
    const decodedToken = await auth.verifyIdToken(token);
    if (decodedToken.email !== email) {
      return res.status(400).json({
        error: {
          message: 'Token email does not match provided email'
        }
      });
    }

    // Check if customer already exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { email }
    });

    if (existingCustomer) {
      return res.status(400).json({
        error: {
          message: 'Customer already exists with this email'
        }
      });
    }

    // Create customer in database
    const customer = await prisma.customer.create({
      data: {
        email,
        firstName,
        lastName,
        phone,
      }
    });

    res.status(201).json({
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
      },
      token: token, // Return the Firebase token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register customer',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, token } = req.body;
    console.log('Login attempt with Firebase token');

    // Verify Firebase token
    const decodedToken = await auth.verifyIdToken(token);
    if (decodedToken.email !== email) {
      return res.status(400).json({
        error: {
          message: 'Token email does not match provided email'
        }
      });
    }

    // Find customer in database
    const customer = await prisma.customer.findUnique({
      where: { email: decodedToken.email }
    });

    if (!customer) {
      return res.status(404).json({
        error: {
          message: 'Customer not found'
        }
      });
    }

    res.json({
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
      },
      token: token, // Return the Firebase token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid authentication token',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
};

export const me = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Not authenticated'
        }
      });
    }

    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user.uid }
    });

    if (!user) {
      return res.status(404).json({
        error: {
          message: 'User not found'
        }
      });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: req.user.isAdmin
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const googleSignIn = async (req: Request, res: Response) => {
  try {
    console.log('Received Google sign-in request:', {
      body: req.body,
      headers: req.headers
    });

    const { token, email, name, photoUrl } = req.body;

    if (!token || !email) {
      console.log('Missing required fields:', { token: !!token, email: !!email });
      return res.status(400).json({
        success: false,
        message: 'Token and email are required'
      });
    }

    // Verify the Firebase ID token
    const decodedToken = await auth.verifyIdToken(token);
    console.log('Decoded Firebase token:', decodedToken);

    if (!decodedToken.email) {
      console.log('No email in decoded token');
      return res.status(400).json({
        success: false,
        message: 'Invalid token: no email found'
      });
    }

    // Transaction to ensure both User and Customer are created/updated
    const result = await prisma.$transaction(async (prisma) => {
      console.log('Starting database transaction');

      // Find or create user
      let user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        // Create new user
        user = await prisma.user.create({
          data: {
            email,
            name: name || email.split('@')[0],
            firebaseUid: decodedToken.uid,
            role: 'USER',
            photoUrl,
          }
        });
      } else {
        // Update existing user
        user = await prisma.user.update({
          where: { email },
          data: {
            name: name || user.name,
            firebaseUid: decodedToken.uid,
            photoUrl: photoUrl || user.photoUrl,
          }
        });
      }

      // Find or create customer
      let customer = await prisma.customer.findUnique({
        where: { email }
      });

      if (!customer) {
        // Split name into firstName and lastName
        const nameParts = (name || '').split(' ');
        const firstName = nameParts[0] || email.split('@')[0];
        const lastName = nameParts.slice(1).join(' ') || '';

        // Create new customer
        customer = await prisma.customer.create({
          data: {
            email,
            firstName,
            lastName,
            phone: '', // This can be updated later
          }
        });
      }

      return { user, customer };
    });

    // Create a custom token for the user
    const customToken = await auth.createCustomToken(decodedToken.uid);

    res.json({
      success: true,
      token: customToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        photoUrl: result.user.photoUrl,
      },
      customer: {
        id: result.customer.id,
        email: result.customer.email,
        firstName: result.customer.firstName,
        lastName: result.customer.lastName,
      }
    });
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to authenticate with Google',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
