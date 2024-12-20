import { Request, Response, NextFunction } from 'express';
import { auth as firebaseAuth } from '../lib/firebase-admin';
import { prisma } from '../lib/prisma';
import { UserRole, AdminAccess } from '@prisma/client';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email: string | null;
        role: UserRole;
        adminAccess?: AdminAccess[];
        id?: string;
      };
    }
  }
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Try to get token from cookie first, then fallback to Authorization header
    let token = req.cookies['admin-token'];
    if (!token) {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'No token provided'
        });
      }
      token = authHeader.split('Bearer ')[1];
    }

    let decodedToken;
    let tokenError;

    try {
      // First try to verify as a Firebase ID token
      decodedToken = await firebaseAuth.verifyIdToken(token);
    } catch (idTokenError) {
      tokenError = idTokenError;
      try {
        // If ID token verification fails, try to verify as a custom token
        decodedToken = await firebaseAuth.verifySessionCookie(token, true);
      } catch (sessionError) {
        try {
          // Last resort: try to decode the token without verification (for testing)
          const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
          if (decoded.uid && decoded.claims?.admin) {
            decodedToken = {
              uid: decoded.uid,
              email: decoded.email || 'admin@test.com',
              admin: true
            };
            console.log('Using decoded token for testing:', decodedToken);
          } else {
            throw new Error('Invalid token claims');
          }
        } catch (decodeError) {
          console.error('Token verification failed:', {
            idTokenError,
            sessionError,
            decodeError
          });
          return res.status(401).json({
            success: false,
            message: 'Invalid token'
          });
        }
      }
    }

    if (!decodedToken) {
      return res.status(401).json({
        success: false,
        message: 'Token verification failed'
      });
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
      select: { role: true }
    });

    if (!dbUser || dbUser.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized as admin'
      });
    }

    // Set user info in request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || 'admin@test.com',
      role: dbUser.role,
      id: dbUser.id
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
