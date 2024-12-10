import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { auth } from '../lib/firebase-admin';
import { z } from 'zod';
import { Emirates } from '@prisma/client';

// Validation schemas
const updateProfileSchema = z.object({
  // User fields
  name: z.string().optional(),
  phone: z.string().optional(),
  
  // Customer fields
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  birthDate: z.string().datetime().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  
  // Notification preferences
  notifications: z.object({
    orderUpdates: z.boolean().optional(),
    promotions: z.boolean().optional(),
    newsletter: z.boolean().optional(),
    sms: z.boolean().optional(),
  }).optional(),
});

const addressSchema = z.object({
  street: z.string().min(1, 'Street address is required'),
  apartment: z.string().min(1, 'Apartment is required'),
  emirates: z.nativeEnum(Emirates),
  postalCode: z.string().min(1, 'Postal code is required'),
  isDefault: z.boolean().optional(),
});

export const UserController = {
  // Profile Management
  async getProfile(req: Request, res: Response) {
    try {
      const [user, customer] = await Promise.all([
        prisma.user.findUnique({
          where: { firebaseUid: req.user!.uid },
          include: {
            notifications: true
          }
        }),
        prisma.customer.findUnique({
          where: { email: req.user!.email },
          include: {
            customerAddresses: true,
            reward: {
              include: {
                history: true
              }
            }
          }
        })
      ]);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          ...user,
          customer: customer || null
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user profile'
      });
    }
  },

  async updateProfile(req: Request, res: Response) {
    try {
      const validation = updateProfileSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid input',
          errors: validation.error.errors
        });
      }

      const { 
        firstName, lastName, birthDate, gender, notifications,
        ...userFields 
      } = validation.data;

      // Start a transaction to update both User and Customer
      const result = await prisma.$transaction(async (tx) => {
        // Update User
        const updatedUser = await tx.user.update({
          where: { firebaseUid: req.user!.uid },
          data: {
            ...userFields,
            notifications: notifications ? {
              upsert: {
                create: notifications,
                update: notifications
              }
            } : undefined
          },
          include: {
            notifications: true
          }
        });

        // Update Customer if customer fields are provided
        let updatedCustomer = null;
        if (firstName || lastName || birthDate || gender) {
          updatedCustomer = await tx.customer.upsert({
            where: { email: req.user!.email },
            create: {
              firstName: firstName || '',
              lastName: lastName || '',
              email: req.user!.email,
              phone: userFields.phone || '',
              birthDate: birthDate ? new Date(birthDate) : null
            },
            update: {
              ...(firstName && { firstName }),
              ...(lastName && { lastName }),
              ...(birthDate && { birthDate: new Date(birthDate) }),
              ...(userFields.phone && { phone: userFields.phone })
            },
            include: {
              customerAddresses: true,
              reward: {
                include: {
                  history: true
                }
              }
            }
          });
        }

        return {
          user: updatedUser,
          customer: updatedCustomer
        };
      });

      res.json({
        success: true,
        data: {
          ...result.user,
          customer: result.customer
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating user profile'
      });
    }
  },

  // Address Management
  async getAddresses(req: Request, res: Response) {
    try {
      // First find the customer associated with the user
      const customer = await prisma.customer.findFirst({
        where: { email: req.user?.email }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      const addresses = await prisma.customerAddress.findMany({
        where: { customerId: customer.id },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      res.json({
        success: true,
        data: addresses
      });
    } catch (error) {
      console.error('Get addresses error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching addresses'
      });
    }
  },

  async addAddress(req: Request, res: Response) {
    try {
      const validation = addressSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          errors: validation.error.errors
        });
      }

      // First find the customer associated with the user
      const customer = await prisma.customer.findFirst({
        where: { email: req.user?.email }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      // If this is set as default, update other addresses
      if (validation.data.isDefault) {
        await prisma.customerAddress.updateMany({
          where: { customerId: customer.id },
          data: { isDefault: false }
        });
      }

      const address = await prisma.customerAddress.create({
        data: {
          ...validation.data,
          customerId: customer.id,
          country: 'United Arab Emirates' // Always set to UAE
        }
      });

      res.json({
        success: true,
        data: address
      });
    } catch (error) {
      console.error('Add address error:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding address'
      });
    }
  },

  async updateAddress(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validation = addressSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          errors: validation.error.errors
        });
      }

      // First find the customer associated with the user
      const customer = await prisma.customer.findFirst({
        where: { email: req.user?.email }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      // Check if address exists and belongs to customer
      const existingAddress = await prisma.customerAddress.findFirst({
        where: { id, customerId: customer.id }
      });

      if (!existingAddress) {
        return res.status(404).json({
          success: false,
          message: 'Address not found'
        });
      }

      // If setting as default, update other addresses
      if (validation.data.isDefault) {
        await prisma.customerAddress.updateMany({
          where: { customerId: customer.id, NOT: { id } },
          data: { isDefault: false }
        });
      }

      const address = await prisma.customerAddress.update({
        where: { id },
        data: {
          ...validation.data,
          country: 'United Arab Emirates' // Always set to UAE
        }
      });

      res.json({
        success: true,
        data: address
      });
    } catch (error) {
      console.error('Update address error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating address'
      });
    }
  },

  async deleteAddress(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // First find the customer associated with the user
      const customer = await prisma.customer.findFirst({
        where: { email: req.user?.email }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      // Check if address exists and belongs to customer
      const existingAddress = await prisma.customerAddress.findFirst({
        where: { id, customerId: customer.id }
      });

      if (!existingAddress) {
        return res.status(404).json({
          success: false,
          message: 'Address not found'
        });
      }

      await prisma.customerAddress.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Address deleted successfully'
      });
    } catch (error) {
      console.error('Delete address error:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting address'
      });
    }
  },

  // Notification Preferences
  async updateNotificationPreferences(req: Request, res: Response) {
    try {
      const preferences = await prisma.notificationPreference.upsert({
        where: {
          userId: req.user!.uid
        },
        update: {
          orderUpdates: req.body.orderUpdates ?? undefined,
          promotions: req.body.promotions ?? undefined,
          newsletter: req.body.newsletter ?? undefined,
          sms: req.body.sms ?? undefined
        },
        create: {
          user: { connect: { firebaseUid: req.user!.uid } },
          orderUpdates: req.body.orderUpdates ?? true,
          promotions: req.body.promotions ?? true,
          newsletter: req.body.newsletter ?? true,
          sms: req.body.sms ?? false
        }
      });

      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      console.error('Update notification preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating notification preferences'
      });
    }
  }
};
