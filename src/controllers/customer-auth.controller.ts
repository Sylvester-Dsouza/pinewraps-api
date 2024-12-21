import { Request, Response } from 'express';
import { auth } from '../lib/firebase-admin';
import { prisma } from '../lib/prisma';
import { AuthProvider } from '@prisma/client';
import { ApiError } from '../utils/ApiError';

export const customerAuth = {
  // Email/Password registration
  register: async (req: Request, res: Response) => {
    try {
      const { email, firstName, lastName, phone } = req.body;
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith('Bearer ')) {
        throw new ApiError('No token provided', 401);
      }

      const token = authHeader.split('Bearer ')[1];
      
      // Verify the Firebase token
      const decodedToken = await auth.verifyIdToken(token);
      
      if (decodedToken.email !== email) {
        throw new ApiError('Token email does not match provided email', 400);
      }

      if (!email || !firstName) {
        throw new ApiError('Missing required fields', 400);
      }

      // Check if customer already exists
      const existingCustomer = await prisma.customer.findUnique({
        where: { email }
      });

      if (existingCustomer) {
        // If customer exists but doesn't have a Firebase UID, update it
        if (!existingCustomer.firebaseUid) {
          const updatedCustomer = await prisma.customer.update({
            where: { email },
            data: {
              firebaseUid: decodedToken.uid,
              firstName: firstName || existingCustomer.firstName,
              lastName: lastName || existingCustomer.lastName,
              phone: phone || existingCustomer.phone,
              provider: 'EMAIL' as AuthProvider,
              isEmailVerified: decodedToken.email_verified || false
            },
            include: {
              reward: true
            }
          });

          // Set custom claims
          await auth.setCustomUserClaims(decodedToken.uid, {
            role: 'CUSTOMER',
            customerId: updatedCustomer.id
          });

          return res.json({
            success: true,
            data: {
              token,
              customer: {
                id: updatedCustomer.id,
                email: updatedCustomer.email,
                firstName: updatedCustomer.firstName,
                lastName: updatedCustomer.lastName,
                phone: updatedCustomer.phone,
                isEmailVerified: updatedCustomer.isEmailVerified,
                reward: updatedCustomer.reward
              }
            }
          });
        }
        throw new ApiError('Email already registered', 400);
      }

      // Create customer in database with Firebase UID
      const customer = await prisma.customer.create({
        data: {
          email,
          firstName,
          lastName: lastName || '',
          phone: phone || '',
          firebaseUid: decodedToken.uid,
          provider: 'EMAIL',
          isEmailVerified: decodedToken.email_verified || false,
          // Create reward account for new customer
          reward: {
            create: {
              points: 0,
              tier: 'GREEN'
            }
          }
        },
        include: {
          reward: true
        }
      });

      // Send welcome email
      try {
        const { UserEmailService } = await import('../services/user-email.service');
        await UserEmailService.sendWelcomeEmail(customer);
        console.log('Welcome email sent to new customer');
      } catch (error) {
        console.error('Error sending welcome email:', error);
      }

      // Set custom claims
      await auth.setCustomUserClaims(decodedToken.uid, {
        role: 'CUSTOMER',
        customerId: customer.id
      });

      res.status(201).json({
        success: true,
        data: {
          token,
          customer: {
            id: customer.id,
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
            isEmailVerified: customer.isEmailVerified,
            reward: customer.reward
          }
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to register customer', 500);
    }
  },

  // Email/Password login
  login: async (req: Request, res: Response) => {
    try {
      console.log('Login attempt received:', {
        headers: req.headers,
        body: req.body
      });
      
      const { email } = req.body;
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith('Bearer ')) {
        console.log('No token provided in request');
        throw new ApiError('No token provided', 401);
      }

      const token = authHeader.split('Bearer ')[1];
      
      // Verify the Firebase token
      const decodedToken = await auth.verifyIdToken(token);
      
      if (decodedToken.email !== email) {
        throw new ApiError('Token email does not match provided email', 400);
      }

      // Find customer by email
      const customer = await prisma.customer.findUnique({
        where: { email },
        include: {
          reward: true
        }
      });

      if (!customer) {
        throw new ApiError('Customer not found', 404);
      }

      // Set custom claims if they don't exist
      await auth.setCustomUserClaims(decodedToken.uid, {
        role: 'CUSTOMER',
        customerId: customer.id
      });

      res.json({
        success: true,
        data: {
          token,
          customer: {
            id: customer.id,
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
            isEmailVerified: customer.isEmailVerified,
            reward: customer.reward
          }
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to login', 500);
    }
  },

  // Social auth (Google, Facebook, Apple)
  socialAuth: async (req: Request, res: Response) => {
    try {
      console.log('Social auth request received:', {
        body: req.body,
        headers: req.headers
      });

      const { token, provider, email, firstName, lastName, imageUrl, phone } = req.body;

      if (!token || !provider) {
        console.log('Missing required fields:', { token: !!token, provider: !!provider });
        throw new ApiError('Token and provider are required', 400);
      }

      console.log('Verifying Firebase token...');
      // Verify the Firebase token
      const decodedToken = await auth.verifyIdToken(token);
      console.log('Firebase token verified:', {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified
      });
      
      // Find or create customer
      const customer = await prisma.$transaction(async (prisma) => {
        console.log('Looking for existing customer with Firebase UID:', decodedToken.uid);
        
        // First try to find by Firebase UID
        let customer = await prisma.customer.findFirst({
          where: { firebaseUid: decodedToken.uid }
        });

        if (!customer) {
          // If not found by UID, check by email to handle migration cases
          console.log('Looking for existing customer with email:', decodedToken.email);
          customer = await prisma.customer.findUnique({
            where: { email: decodedToken.email }
          });

          if (customer) {
            // If found by email but different UID, this is a different account
            console.log('Found customer with same email but different UID, creating new account');
            const randomSuffix = Math.random().toString(36).substring(2, 7);
            const newEmail = `${decodedToken.email.split('@')[0]}+${randomSuffix}@${decodedToken.email.split('@')[1]}`;
            
            customer = await prisma.customer.create({
              data: {
                email: newEmail,
                firstName: decodedToken.given_name || decodedToken.name?.split(' ')[0] || '',
                lastName: decodedToken.family_name || decodedToken.name?.split(' ').slice(1).join(' ') || '',
                phone: decodedToken.phone_number || null,
                firebaseUid: decodedToken.uid,
                provider: provider as AuthProvider,
                isEmailVerified: decodedToken.email_verified || false,
                reward: {
                  create: {
                    points: 0,
                    totalPoints: 0,
                    tier: 'GREEN'
                  }
                }
              },
              include: {
                reward: true
              }
            });
          }
        }

        if (!customer) {
          console.log('No existing customer found, creating new customer');
          // Extract name and other data from token or request body
          const nameParts = (decodedToken.name || '').split(' ');
          const firstNameToUse = firstName || nameParts[0] || decodedToken.email?.split('@')[0] || '';
          const lastNameToUse = lastName || nameParts.slice(1).join(' ') || '';
          const phoneToUse = phone || decodedToken.phone_number || null;

          console.log('Creating customer with data:', {
            email: decodedToken.email,
            firstName: firstNameToUse,
            lastName: lastNameToUse,
            phone: phoneToUse,
            firebaseUid: decodedToken.uid,
            provider
          });

          customer = await prisma.customer.create({
            data: {
              email: decodedToken.email,
              firstName: decodedToken.given_name || decodedToken.name?.split(' ')[0] || '',
              lastName: decodedToken.family_name || decodedToken.name?.split(' ').slice(1).join(' ') || '',
              phone: decodedToken.phone_number || null,
              firebaseUid: decodedToken.uid,
              provider: provider as AuthProvider,
              isEmailVerified: decodedToken.email_verified || false,
              reward: {
                create: {
                  points: 0,
                  totalPoints: 0,
                  tier: 'GREEN'
                }
              }
            },
            include: {
              reward: true
            }
          });

          // Send welcome email for new social auth users
          try {
            const { UserEmailService } = await import('../services/user-email.service');
            await UserEmailService.sendWelcomeEmail(customer);
            console.log('Welcome email sent to new social auth customer');
          } catch (error) {
            console.error('Error sending welcome email:', error);
          }

          console.log('Created new customer:', { 
            id: customer.id, 
            email: customer.email,
            provider,
            reward: customer.reward 
          });
        } else {
          console.log('Updating existing customer:', customer.id);
          // Update existing customer with any new information
          customer = await prisma.customer.update({
            where: { id: customer.id },
            data: {
              firebaseUid: decodedToken.uid,
              provider: provider as AuthProvider,
              isEmailVerified: decodedToken.email_verified || customer.isEmailVerified,
              // Only update name if it's provided in the token
              ...(decodedToken.name && {
                firstName: decodedToken.name.split(' ')[0],
                lastName: decodedToken.name.split(' ').slice(1).join(' ')
              }),
              // Only update phone if it's provided in the token
              ...(decodedToken.phone_number && {
                phone: decodedToken.phone_number
              })
            },
            include: {
              reward: true
            }
          });

          console.log('Updated existing customer:', { 
            id: customer.id, 
            email: customer.email,
            provider,
            reward: customer.reward 
          });
        }

        return customer;
      });

      console.log('Setting custom claims for Firebase user');
      // Set custom claims for the Firebase user
      await auth.setCustomUserClaims(decodedToken.uid, {
        role: 'CUSTOMER',
        customerId: customer.id
      });

      console.log('Generating custom token');
      // Generate a custom token for the customer
      const customToken = await auth.createCustomToken(decodedToken.uid, {
        role: 'CUSTOMER',
        customerId: customer.id
      });

      console.log('Sending response');
      res.json({
        success: true,
        data: {
          token: customToken,
          customer: {
            id: customer.id,
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
            isEmailVerified: customer.isEmailVerified,
            reward: customer.reward
          }
        }
      });
    } catch (error) {
      console.error('Social auth error:', error);
      throw error;
    }
  },

  // Create session cookie
  createSession: async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        throw new ApiError('No token provided', 401);
      }

      const token = authHeader.split('Bearer ')[1];
      
      // Verify the Firebase token
      const decodedToken = await auth.verifyIdToken(token);
      
      // Create a session cookie
      const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
      const sessionCookie = await auth.createSessionCookie(token, { expiresIn });
      
      // Set cookie options
      const options = {
        maxAge: expiresIn,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      };

      // Set the cookie
      res.cookie('__session', sessionCookie, options);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Create session error:', error);
      throw new ApiError('Failed to create session', 500);
    }
  },

  // Clear session cookie
  clearSession: async (req: Request, res: Response) => {
    try {
      res.clearCookie('__session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
      res.json({ success: true });
    } catch (error) {
      console.error('Clear session error:', error);
      throw new ApiError('Failed to clear session', 500);
    }
  },

  // Update customer profile
  updateProfile: async (req: Request, res: Response) => {
    try {
      const { firstName, lastName, phone, dateOfBirth } = req.body;
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith('Bearer ')) {
        throw new ApiError('No token provided', 401);
      }

      const token = authHeader.split('Bearer ')[1];
      
      // Verify the Firebase token
      const decodedToken = await auth.verifyIdToken(token);
      
      // Find customer by Firebase UID
      const customer = await prisma.customer.findFirst({
        where: { firebaseUid: decodedToken.uid }
      });

      if (!customer) {
        throw new ApiError('Customer not found', 404);
      }

      // Update customer profile
      const updatedCustomer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          firstName: firstName || customer.firstName,
          lastName: lastName || customer.lastName,
          phone: phone || customer.phone,
          birthDate: dateOfBirth ? new Date(dateOfBirth) : customer.birthDate
        },
        include: {
          reward: true
        }
      });

      res.json({
        success: true,
        data: {
          customer: {
            id: updatedCustomer.id,
            email: updatedCustomer.email,
            firstName: updatedCustomer.firstName,
            lastName: updatedCustomer.lastName,
            phone: updatedCustomer.phone,
            isEmailVerified: updatedCustomer.isEmailVerified,
            dateOfBirth: updatedCustomer.birthDate ? updatedCustomer.birthDate.toISOString() : null,
            reward: updatedCustomer.reward
          }
        }
      });
    } catch (error) {
      console.error('Profile update error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to update profile', 500);
    }
  },

  // Get current customer profile
  me: async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        throw new ApiError('No token provided', 401);
      }

      const decodedToken = await auth.verifyIdToken(token);
      console.log('Decoded token:', {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified
      });

      // Map Firebase provider to our AuthProvider enum
      const getAuthProvider = (firebaseProvider: string): AuthProvider => {
        const provider = firebaseProvider.toLowerCase();
        if (provider.includes('google')) return 'GOOGLE';
        if (provider.includes('facebook')) return 'FACEBOOK';
        if (provider.includes('apple')) return 'APPLE';
        return 'EMAIL';
      };

      // First try to find by Firebase UID
      let customer = await prisma.customer.findUnique({
        where: {
          firebaseUid: decodedToken.uid
        },
        include: {
          addresses: {
            select: {
              id: true,
              street: true,
              apartment: true,
              emirate: true,
              city: true,
              country: true,
              pincode: true,
              isDefault: true,
              createdAt: true,
              updatedAt: true
            },
            orderBy: {
              createdAt: "desc"
            }
          },
          reward: true,
          orders: {
            orderBy: {
              createdAt: "desc"
            },
            take: 5
          }
        }
      });

      // If not found by Firebase UID, try by email
      if (!customer && decodedToken.email) {
        console.log('Customer not found by Firebase UID, trying email:', decodedToken.email);
        customer = await prisma.customer.findUnique({
          where: { email: decodedToken.email },
          include: {
            addresses: {
              select: {
                id: true,
                street: true,
                apartment: true,
                emirate: true,
                city: true,
                country: true,
                pincode: true,
                isDefault: true,
                createdAt: true,
                updatedAt: true
              },
              orderBy: {
                createdAt: "desc"
              }
            },
            reward: true,
            orders: {
              orderBy: {
                createdAt: "desc"
              },
              take: 5
            }
          }
        });
      }

      // If still not found, create new customer
      if (!customer && decodedToken.email) {
        console.log('Creating new customer for:', decodedToken.email);
        
        // Extract name parts from email or decoded token
        let firstName = 'New';
        let lastName = 'Customer';
        
        if (decodedToken.name) {
          const nameParts = decodedToken.name.split(' ');
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ') || 'Customer'; // Default last name if not provided
        }

        customer = await prisma.customer.create({
          data: {
            firebaseUid: decodedToken.uid,
            email: decodedToken.email,
            firstName,
            lastName,
            isEmailVerified: decodedToken.email_verified || false,
            provider: getAuthProvider(decodedToken.firebase.sign_in_provider)
          },
          include: {
            addresses: true,
            reward: true,
            orders: {
              orderBy: {
                createdAt: "desc"
              },
              take: 5
            }
          }
        });
      }

      if (!customer) {
        throw new ApiError('Customer not found', 404);
      }

      // Update Firebase UID if not set
      if (!customer.firebaseUid) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { firebaseUid: decodedToken.uid }
        });
      }

      return res.json({
        success: true,
        data: {
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          dateOfBirth: customer.birthDate,
          isEmailVerified: customer.isEmailVerified,
          provider: customer.provider,
          addresses: customer.addresses,
          reward: customer.reward,
          recentOrders: customer.orders
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      if (error instanceof ApiError) {
        return res.status(error.statusCode || 500).json({
          success: false,
          error: {
            code: error.code || 'PROFILE_ERROR',
            message: error.message
          }
        });
      }
      return res.status(500).json({
        success: false,
        error: {
          code: 'PROFILE_ERROR',
          message: 'Failed to get profile',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }
};
