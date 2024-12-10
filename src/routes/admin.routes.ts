import { Router, Request, Response } from 'express';
import { requireAuth, requireSuperAdmin, requireAdmin } from '../middleware/auth';
import { auth } from '../lib/firebase-admin';
import { prisma } from '../lib/prisma';
import { AdminAccess, UserRole } from '@prisma/client';
import { ApiError } from '../utils/ApiError';

const router = Router();

// Admin Authentication Routes
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      throw new ApiError('Firebase ID token is required', 400);
    }

    // Verify the Firebase ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    const { uid, email } = decodedToken;

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { firebaseUid: uid }
    });

    if (!user || user.role !== UserRole.ADMIN) {
      throw new ApiError('Unauthorized: Not an admin user', 403);
    }

    if (!user.isActive) {
      throw new ApiError('Account is deactivated', 403);
    }

    // Get admin claims
    const customClaims = (await auth.getUser(uid)).customClaims || {};
    const isSuperAdmin = customClaims.superAdmin === true;

    res.json({
      success: true,
      data: {
        user: {
          ...user,
          isSuperAdmin
        }
      }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Login failed', 500);
  }
});

// Super Admin Routes
// These routes are only accessible by super admin users

// Create new admin user
router.post('/users', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { email, password, name, adminAccess = [] } = req.body;

    if (!email || !password || !name) {
      throw new ApiError('Email, password, and name are required', 400);
    }

    // Check if user exists in Firebase
    try {
      const existingUser = await auth.getUserByEmail(email);
      if (existingUser) {
        throw new ApiError('Email already exists', 400);
      }
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Create Firebase user
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: true
    });

    // Create user in database
    const admin = await prisma.user.create({
      data: {
        email,
        name,
        firebaseUid: userRecord.uid,
        role: UserRole.ADMIN,
        adminAccess,
        isActive: true
      }
    });

    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: UserRole.ADMIN,
      adminId: admin.id,
      access: admin.adminAccess
    });

    res.json({
      success: true,
      data: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        adminAccess: admin.adminAccess,
        isActive: admin.isActive
      }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: { message: error.message }
      });
    } else {
      console.error('Error creating admin:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to create admin user' }
      });
    }
  }
});

// Get all admin users
router.get('/users', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: UserRole.ADMIN,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        adminAccess: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      data: admins
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch admin users' }
    });
  }
});

// Update admin user
router.put('/users/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, adminAccess, password } = req.body;

    const admin = await prisma.user.findUnique({
      where: { id }
    });

    if (!admin) {
      throw new ApiError('Admin not found', 404);
    }

    // Update password if provided
    if (password) {
      await auth.updateUser(admin.firebaseUid, {
        password
      });
    }

    // Update admin in database
    const updatedAdmin = await prisma.user.update({
      where: { id },
      data: {
        name: name || undefined,
        adminAccess: adminAccess || undefined
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        adminAccess: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Update custom claims if access changed
    if (adminAccess) {
      await auth.setCustomUserClaims(admin.firebaseUid, {
        role: UserRole.ADMIN,
        adminId: admin.id,
        access: adminAccess
      });
    }

    res.json({
      success: true,
      data: updatedAdmin
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: { message: error.message }
      });
    } else {
      console.error('Error updating admin:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to update admin user' }
      });
    }
  }
});

// Deactivate admin user
router.put('/users/:id/deactivate', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const admin = await prisma.user.findUnique({
      where: { id }
    });

    if (!admin) {
      throw new ApiError('Admin not found', 404);
    }

    // Disable Firebase user
    await auth.updateUser(admin.firebaseUid, {
      disabled: true
    });

    // Update admin in database
    const updatedAdmin = await prisma.user.update({
      where: { id },
      data: {
        isActive: false
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        adminAccess: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      data: updatedAdmin
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: { message: error.message }
      });
    } else {
      console.error('Error deactivating admin:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to deactivate admin user' }
      });
    }
  }
});

// Activate admin user
router.put('/users/:id/activate', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const admin = await prisma.user.findUnique({
      where: { id }
    });

    if (!admin) {
      throw new ApiError('Admin not found', 404);
    }

    // Enable Firebase user
    await auth.updateUser(admin.firebaseUid, {
      disabled: false
    });

    // Update admin in database
    const updatedAdmin = await prisma.user.update({
      where: { id },
      data: {
        isActive: true
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        adminAccess: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      data: updatedAdmin
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: { message: error.message }
      });
    } else {
      console.error('Error activating admin:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to activate admin user' }
      });
    }
  }
});

// Admin Routes (accessible by both admin and super admin)
// Get current admin profile
router.get('/me', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      throw new ApiError('Unauthorized', 401);
    }

    const admin = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        adminAccess: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!admin) {
      throw new ApiError('Admin not found', 404);
    }

    res.json({
      success: true,
      data: admin
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: { message: error.message }
      });
    } else {
      console.error('Error fetching admin profile:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch admin profile' }
      });
    }
  }
});

// Update current admin profile
router.put('/me', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      throw new ApiError('Unauthorized', 401);
    }

    const { name, password } = req.body;

    const admin = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!admin) {
      throw new ApiError('Admin not found', 404);
    }

    // Update password if provided
    if (password) {
      await auth.updateUser(admin.firebaseUid, {
        password
      });
    }

    // Update admin in database
    const updatedAdmin = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name || undefined
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        adminAccess: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      data: updatedAdmin
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: { message: error.message }
      });
    } else {
      console.error('Error updating admin profile:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to update admin profile' }
      });
    }
  }
});

export default router;
