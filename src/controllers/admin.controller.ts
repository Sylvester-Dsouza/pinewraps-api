import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { auth } from '../lib/firebase-admin';
import { ApiError } from '../utils/ApiError';

export const createAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, displayName, adminAccess } = req.body;

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
    });

    // Set custom claims for admin
    await auth.setCustomUserClaims(userRecord.uid, {
      admin: true,
      role: 'ADMIN',
    });

    // Create user in Prisma database
    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        firebaseUid: userRecord.uid,
        role: 'ADMIN',
        adminAccess,
        isActive: true,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          adminAccess: user.adminAccess,
        },
      },
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    next(new ApiError('Failed to create admin user', 500));
  }
};
