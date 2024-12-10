import { Request, Response, NextFunction } from 'express';
import { auth } from '../lib/firebase-admin';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/ApiError';
import { UserRole } from '@prisma/client';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        uid: string; // Firebase UID
        isSuperAdmin: boolean;
        adminAccess?: string[];
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
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(new ApiError('No token provided', 401));
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return next(new ApiError('Invalid token format', 401));
    }

    try {
      // Verify the Firebase token
      const decodedToken = await auth.verifyIdToken(token);
      const uid = decodedToken.uid;
      const claims = decodedToken.claims || {};

      console.log('Decoded token:', { uid, claims });

      // Check if this is a customer route
      const customerRoutes = ['/api/customers', '/api/rewards', '/api/payments'];
      let isCustomerRoute = customerRoutes.some(route => req.baseUrl.startsWith(route));
      
      // Special handling for /api/orders - only treat as customer route if not admin path
      if (req.baseUrl === '/api/orders') {
        const adminPaths = ['/analytics', '/export'];
        isCustomerRoute = !adminPaths.some(path => req.path === path);
      }
      
      console.log('Route info:', {
        baseUrl: req.baseUrl,
        path: req.path,
        isCustomerRoute
      });

      if (isCustomerRoute) {
        // Look up customer record first
        const customer = await prisma.customer.findUnique({
          where: {
            firebaseUid: uid,
          },
        });

        if (customer) {
          console.log('Found customer:', customer.id);
          req.user = {
            id: customer.id,
            email: customer.email,
            role: 'CUSTOMER',
            uid: customer.firebaseUid,
            isSuperAdmin: false,
          };
          return next();
        }

        // If customer not found by Firebase UID, try by email
        if (decodedToken.email) {
          const customerByEmail = await prisma.customer.findUnique({
            where: { email: decodedToken.email }
          });

          if (customerByEmail) {
            // Update customer with Firebase UID if missing
            const updatedCustomer = await prisma.customer.update({
              where: { id: customerByEmail.id },
              data: { firebaseUid: uid }
            });

            console.log('Found and updated customer by email:', updatedCustomer.id);
            req.user = {
              id: updatedCustomer.id,
              email: updatedCustomer.email,
              role: 'CUSTOMER',
              uid: updatedCustomer.firebaseUid,
              isSuperAdmin: false,
            };
            return next();
          }
        }
      }

      // If not a customer route or customer not found, check for admin user
      const user = await prisma.user.findFirst({
        where: {
          firebaseUid: uid,
          isActive: true,
        },
      });

      if (user) {
        console.log('Found admin user:', user.firebaseUid);
        req.user = {
          id: user.id,
          email: user.email || '',
          role: user.role,
          uid: user.firebaseUid,
          isSuperAdmin: user.role === UserRole.SUPER_ADMIN,
          adminAccess: user.adminAccess || [],
        };
        return next();
      }

      // If neither customer nor admin user found
      return next(new ApiError('User not found', 401));
    } catch (error) {
      console.error('Token verification error:', error);
      return next(new ApiError('Invalid token', 401));
    }
  } catch (error) {
    console.error('Auth error:', error);
    return next(new ApiError('Invalid token', 401));
  }
};

// Middleware to require admin role
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new ApiError('Authentication required', 401));
  }
  
  console.log('Checking admin access:', {
    userRole: req.user.role,
    isSuperAdmin: req.user.isSuperAdmin,
    adminAccess: req.user.adminAccess
  });

  if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.SUPER_ADMIN) {
    return next(new ApiError('Admin access required', 403));
  }
  next();
};

// Middleware to require super admin role
export const requireSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || !req.user.isSuperAdmin) {
    return next(new ApiError('Super admin access required', 403));
  }
  next();
};

// Middleware to require specific admin access
export const requireAccess = (access: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.adminAccess) {
      return next(new ApiError('Access denied', 403));
    }

    const hasAccess = access.some(a => req.user!.adminAccess!.includes(a));
    if (!hasAccess) {
      return next(new ApiError('Access denied', 403));
    }

    next();
  };
};
