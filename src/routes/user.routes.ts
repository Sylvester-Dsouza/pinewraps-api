import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { requireAuth, requireSuperAdmin } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { auth } from '../lib/firebase-admin';
import { ApiError } from '../utils/ApiError';

const router = Router();

// Public routes
router.post('/login', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Firebase ID token is required'
      });
    }

    // Verify the Firebase ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    const { uid, email } = decodedToken;

    // Find or create user in database
    let user = await prisma.user.findUnique({
      where: { firebaseUid: uid }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          firebaseUid: uid,
          email: email || '',
          role: 'USER'
        }
      });
    }

    // Check if user is a regular user
    if (user.role !== 'USER') {
      throw new ApiError('Invalid user type', 403);
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Verify token and get user info
router.post('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      
      const user = await prisma.user.findUnique({
        where: { firebaseUid: decodedToken.uid }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const customClaims = (await auth.getUser(decodedToken.uid)).customClaims || {};
      
      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isAdmin: customClaims.admin === true
          }
        }
      });
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Protected routes
router.get('/profile', requireAuth, UserController.getProfile);
router.put('/profile', requireAuth, UserController.updateProfile);

// Address Management
router.get('/addresses', requireAuth, UserController.getAddresses);
router.post('/addresses', requireAuth, UserController.addAddress);
router.put('/addresses/:id', requireAuth, UserController.updateAddress);
router.delete('/addresses/:id', requireAuth, UserController.deleteAddress);

// Notification Preferences
router.put('/notifications', requireAuth, UserController.updateNotificationPreferences);

// Get current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        rewardPoints: true,
        createdAt: true,
      }
    });

    res.json({
      success: true,
      data: {
        ...user,
        isAdmin: req.user!.isAdmin
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user information'
    });
  }
});

// Update user profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, phone } = req.body;

    const user = await prisma.user.update({
      where: { firebaseUid: req.user!.uid },
      data: {
        name: name || undefined,
        phone: phone || undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        rewardPoints: true,
        createdAt: true,
      }
    });

    res.json({
      success: true,
      data: {
        ...user,
        isAdmin: req.user!.isAdmin
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// Admin routes
router.get('/', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const role = req.query.role as string;
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    // Only filter by role if specifically requested
    if (role && role !== 'all') {
      where.role = role.toUpperCase();
    }
    
    // Add search filter
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          phone: true,
          gender: true,
          birthDate: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        users,
        total,
        page,
        limit,
      },
    });
  } catch (error) {
    next(new ApiError('Error fetching users', 500));
  }
});

// Get single user
router.get('/:userId', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        phone: true,
        gender: true,
        birthDate: true,
        addresses: {
          select: {
            id: true,
            type: true,
            isDefault: true,
            firstName: true,
            lastName: true,
            street: true,
            apartment: true,
            city: true,
            state: true,
            zipCode: true,
            country: true,
            phone: true,
          }
        },
        notifications: {
          select: {
            orderUpdates: true,
            promotions: true,
            newsletter: true,
            sms: true,
          }
        }
      }
    });

    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(new ApiError('Error fetching user', 500));
  }
});

// Update user role
router.patch('/:userId/role', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['USER', 'ADMIN'].includes(role)) {
      return next(new ApiError('Invalid role specified', 400));
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        phone: true,
        gender: true,
        birthDate: true,
        firebaseUid: true,
      }
    });

    // Update Firebase custom claims
    await auth.setCustomUserClaims(user.firebaseUid, {
      admin: role === 'ADMIN',
    });

    // Remove firebaseUid from response
    const { firebaseUid, ...userResponse } = user;

    res.json({
      success: true,
      data: userResponse,
    });
  } catch (error) {
    next(new ApiError('Error updating user role', 500));
  }
});

// Delete user
router.delete('/:userId', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.delete({
      where: { id: userId },
      select: {
        firebaseUid: true,
      }
    });

    // Delete user from Firebase
    await auth.deleteUser(user.firebaseUid);

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(new ApiError('Error deleting user', 500));
  }
});

// Admin only: Set user as admin
router.post('/:userId/make-admin', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firebaseUid: true }
    });

    if (!user?.firebaseUid) {
      return next(new ApiError('User not found', 404));
    }

    // Set admin claim in Firebase
    await auth.setCustomUserClaims(user.firebaseUid, { admin: true });

    // Update user role in database
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'ADMIN' }
    });

    res.json({
      success: true,
      message: 'User has been made admin'
    });
  } catch (error) {
    next(new ApiError('Error making user admin', 500));
  }
});

// Admin only: Remove admin status
router.post('/:userId/remove-admin', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firebaseUid: true }
    });

    if (!user?.firebaseUid) {
      return next(new ApiError('User not found', 404));
    }

    // Remove admin claim in Firebase
    await auth.setCustomUserClaims(user.firebaseUid, { admin: false });

    // Update user role in database
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'USER' }
    });

    res.json({
      success: true,
      message: 'Admin status removed'
    });
  } catch (error) {
    next(new ApiError('Error removing admin status', 500));
  }
});

export default router;
