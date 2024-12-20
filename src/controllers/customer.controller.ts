import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import nodemailer from 'nodemailer';

const RequestPasswordResetSchema = z.object({
  email: z.string().email()
});

const ResetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8)
});

export class CustomerController {
  // Request password reset
  static async requestPasswordReset(req: Request, res: Response) {
    try {
      const { email } = RequestPasswordResetSchema.parse(req.body);

      // Find customer
      const customer = await prisma.customer.findUnique({
        where: { email }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: 'No customer found with this email'
          }
        });
      }

      // Generate reset token
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Save reset token
      await prisma.passwordReset.upsert({
        where: { customerId: customer.id },
        create: {
          token,
          expiresAt,
          customerId: customer.id
        },
        update: {
          token,
          expiresAt
        }
      });

      // Send reset email
      const transporter = nodemailer.createTransport({
        // Add your email service configuration here
      });

      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
      
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: customer.email,
        subject: 'Password Reset Request',
        html: `
          <h1>Password Reset Request</h1>
          <p>You have requested to reset your password. Click the link below to proceed:</p>
          <a href="${resetLink}">Reset Password</a>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `
      });

      return res.json({
        success: true,
        message: 'Password reset instructions sent to email'
      });
    } catch (error) {
      console.error('Request password reset error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: error.errors
          }
        });
      }
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process password reset request'
        }
      });
    }
  }

  // Reset password with token
  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = ResetPasswordSchema.parse(req.body);

      // Find valid reset token
      const resetRequest = await prisma.passwordReset.findUnique({
        where: { token },
        include: { customer: true }
      });

      if (!resetRequest || resetRequest.expiresAt < new Date()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired reset token'
          }
        });
      }

      // Update password in Firebase (assuming you're using Firebase Auth)
      // Add your Firebase password update logic here

      // Delete used token
      await prisma.passwordReset.delete({
        where: { token }
      });

      return res.json({
        success: true,
        message: 'Password reset successful'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: error.errors
          }
        });
      }
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to reset password'
        }
      });
    }
  }

  // Get customer profile with all related data
  static async getCustomerProfile(req: Request, res: Response) {
    try {
      const customer = await prisma.customer.findUnique({
        where: { firebaseUid: req.user!.uid },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          rewardPoints: true,
          addresses: {
            orderBy: [
              { isDefault: 'desc' },
              { createdAt: 'desc' }
            ],
            select: {
              id: true,
              type: true,
              street: true,
              apartment: true,
              emirate: true,
              city: true,
              pincode: true,
              isDefault: true
            }
          }
        }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      res.json({
        success: true,
        data: customer
      });
    } catch (error) {
      console.error('Get customer profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch customer profile'
      });
    }
  }

  // Get all customers (admin only)
  static async getAllCustomers(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          skip,
          take: limit,
          orderBy: {
            createdAt: "desc"
          },
          include: {
            addresses: true,
            orders: {
              take: 5,
              orderBy: {
                createdAt: 'desc'
              }
            }
          }
        }),
        prisma.customer.count()
      ]);

      // Transform the response to match the frontend expectations
      const transformedCustomers = customers.map(customer => ({
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        birthDate: customer.birthDate,
        isEmailVerified: customer.isEmailVerified,
        provider: customer.provider,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        addresses: customer.addresses,
        rewardPoints: customer.rewardPoints,
        orders: customer.orders
      }));

      return res.json({
        success: true,
        data: {
          customers: transformedCustomers,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Error getting customers:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get customers'
        }
      });
    }
  }

  // Get customer by ID (admin only)
  static async getCustomerById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
          addresses: true,
          orders: {
            take: 5,
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: 'Customer not found'
          }
        });
      }

      // Transform the response to match the frontend expectations
      const transformedCustomer = {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        birthDate: customer.birthDate,
        isEmailVerified: customer.isEmailVerified,
        provider: customer.provider,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        addresses: customer.addresses,
        rewardPoints: customer.rewardPoints,
        orders: customer.orders
      };

      return res.json({
        success: true,
        data: transformedCustomer
      });
    } catch (error) {
      console.error('Error getting customer:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get customer'
        }
      });
    }
  }

  // Delete customer (admin only)
  static async deleteCustomer(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const customer = await prisma.customer.findUnique({
        where: { id }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: 'Customer not found'
          }
        });
      }

      await prisma.customer.delete({
        where: { id }
      });

      return res.json({
        success: true,
        message: 'Customer deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting customer:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete customer'
        }
      });
    }
  }
}
