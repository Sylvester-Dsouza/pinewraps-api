import { Request, Response } from 'express';
import { auth } from '../lib/firebase-admin';
import { prisma } from '../lib/prisma';
import { UserRole, AdminAccess } from '@prisma/client';
import { ApiError } from '../utils/ApiError';

export const adminAuth = {
  // Admin login
  login: async (req: Request, res: Response) => {
    try {
      const { idToken } = req.body;

      if (!idToken) {
        throw new ApiError('Firebase ID token is required', 400);
      }

      // Verify the Firebase ID token
      const decodedToken = await auth.verifyIdToken(idToken);
      const { uid, email } = decodedToken;

      // Get admin from database
      const admin = await prisma.user.findUnique({
        where: { firebaseUid: uid }
      });

      // If user doesn't exist in our database but has a valid Firebase token,
      // they might be trying to initialize as super admin
      if (!admin) {
        // Check if any super admin exists
        const existingSuperAdmin = await prisma.user.findFirst({
          where: { role: UserRole.SUPER_ADMIN }
        });

        if (!existingSuperAdmin) {
          // Allow them to initialize as super admin
          res.json({
            success: true,
            data: {
              requiresInitialization: true,
              email
            }
          });
          return;
        } else {
          throw new ApiError('User not found', 404);
        }
      }

      if (!admin.isActive) {
        throw new ApiError('Account is inactive', 403);
      }

      // Check if user is an admin or super admin
      if (admin.role !== UserRole.SUPER_ADMIN && admin.role !== UserRole.ADMIN) {
        throw new ApiError('Not authorized as admin', 403);
      }

      // Get custom claims to check super admin status
      const { customClaims } = await auth.getUser(uid);
      const isSuperAdmin = customClaims?.superAdmin === true;

      res.json({
        success: true,
        data: {
          user: {
            ...admin,
            isSuperAdmin
          }
        }
      });
    } catch (error: any) {
      console.error('Admin login error:', error);
      throw new ApiError(error.message || 'Failed to login', error.statusCode || 500);
    }
  },

  // Verify admin token
  verify: async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        throw new ApiError('No token provided', 401);
      }

      const token = authHeader.split('Bearer ')[1];
      
      try {
        // Verify the Firebase token
        const decodedToken = await auth.verifyIdToken(token);

        // Get admin from database
        const admin = await prisma.user.findUnique({
          where: { firebaseUid: decodedToken.uid }
        });

        if (!admin || !admin.isActive) {
          throw new ApiError('User not found or inactive', 401);
        }

        // Check if user is an admin or super admin
        if (admin.role !== UserRole.SUPER_ADMIN && admin.role !== UserRole.ADMIN) {
          throw new ApiError('Not authorized as admin', 403);
        }

        res.json({
          success: true,
          data: {
            user: {
              id: admin.id,
              email: admin.email,
              name: admin.name,
              role: admin.role,
              adminAccess: admin.adminAccess
            }
          }
        });
      } catch (error) {
        console.error('Token verification error:', error);
        throw new ApiError('Invalid token', 401);
      }
    } catch (error) {
      console.error('Admin verify error:', error);
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            message: error.message
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            message: 'Internal server error'
          }
        });
      }
    }
  },

  // Create initial super admin (only works if no super admin exists)
  initializeSuperAdmin: async (req: Request, res: Response) => {
    try {
      const { email, idToken } = req.body;

      if (!email || !idToken) {
        throw new ApiError('Email and Firebase ID token are required', 400);
      }

      // Verify the Firebase ID token
      const decodedToken = await auth.verifyIdToken(idToken);
      const { uid } = decodedToken;

      // Check if any super admin exists
      const existingSuperAdmin = await prisma.user.findFirst({
        where: { role: UserRole.SUPER_ADMIN }
      });

      if (existingSuperAdmin) {
        throw new ApiError('Super admin already exists', 400);
      }

      // Create super admin user
      const superAdmin = await prisma.user.create({
        data: {
          email,
          firebaseUid: uid,
          role: UserRole.SUPER_ADMIN,
          adminAccess: Object.values(AdminAccess),
          isActive: true
        }
      });

      // Set custom claims for Firebase user
      await auth.setCustomUserClaims(uid, {
        superAdmin: true,
        role: UserRole.SUPER_ADMIN
      });

      res.json({
        success: true,
        data: {
          user: superAdmin
        }
      });
    } catch (error: any) {
      console.error('Initialize super admin error:', error);
      throw new ApiError(error.message || 'Failed to initialize super admin', error.statusCode || 500);
    }
  }
};
