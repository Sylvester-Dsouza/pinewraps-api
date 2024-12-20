import { Router } from 'express';
import { adminAuth } from '../controllers/admin-auth.controller';
import { asyncHandler } from '../middleware/async';
import { prisma } from '../lib/prisma';
import { auth } from '../lib/firebase-admin';
import { ApiError } from '../utils/ApiError';

const router = Router();

// Admin authentication routes
router.post('/login', asyncHandler(adminAuth.login));
router.post('/initialize', asyncHandler(adminAuth.initializeSuperAdmin));

// Verify admin token
router.post('/verify', async (req, res) => {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new ApiError('No token provided', 401);
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase ID token
    const decodedToken = await auth.verifyIdToken(token);
    const { uid, email } = decodedToken;

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { firebaseUid: uid }
    });

    if (!user) {
      throw new ApiError('User not found', 404);
    }

    // Verify admin status
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      throw new ApiError('Not authorized as admin', 403);
    }

    // Verify user is active
    if (!user.isActive) {
      throw new ApiError('Account is inactive', 403);
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          adminAccess: user.adminAccess,
          name: user.name
        }
      }
    });
  } catch (error) {
    console.error('Verify token error:', error);
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
});

export default router;
