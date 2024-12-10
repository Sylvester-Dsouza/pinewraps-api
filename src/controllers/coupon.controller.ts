import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { CURRENCY, formatCurrency } from '../utils/currency';

// Validation schemas
const CreateCouponSchema = z.object({
  code: z.string().min(1),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  value: z.number().positive(),
  description: z.string().optional(),
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().optional().transform(str => str ? new Date(str) : undefined),
  usageLimit: z.number().optional(),
  minOrderAmount: z.number().optional(),
  maxDiscount: z.number().optional(),
});

const UpdateCouponSchema = CreateCouponSchema.partial();

// Format coupon values for response
const formatCouponValues = (coupon: any) => {
  return {
    ...coupon,
    value: coupon.type === 'FIXED_AMOUNT' ? formatCurrency(coupon.value) : `${coupon.value}%`,
    minOrderAmount: coupon.minOrderAmount ? formatCurrency(coupon.minOrderAmount) : null,
    maxDiscount: coupon.maxDiscount ? formatCurrency(coupon.maxDiscount) : null
  };
};

export class CouponController {
  // Get all coupons
  static async getCoupons(req: Request, res: Response) {
    try {
      const coupons = await prisma.coupon.findMany({
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          _count: {
            select: {
              usages: true
            }
          }
        }
      });

      // Format currency values
      const formattedCoupons = coupons.map(coupon => ({
        ...formatCouponValues(coupon),
        usageCount: coupon._count.usages
      }));

      return res.json({
        success: true,
        data: formattedCoupons
      });
    } catch (error) {
      console.error('Error in getCoupons:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch coupons'
      });
    }
  }

  // Get single coupon
  static async getCoupon(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const coupon = await prisma.coupon.findUnique({
        where: { id },
        include: {
          usages: {
            include: {
              customer: true,
              order: true
            },
            take: 10,
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!coupon) {
        return res.status(404).json({
          success: false,
          error: 'Coupon not found'
        });
      }

      // Format currency values
      const formattedCoupon = formatCouponValues(coupon);

      return res.json({
        success: true,
        data: formattedCoupon
      });
    } catch (error) {
      console.error('Error in getCoupon:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch coupon'
      });
    }
  }

  // Create new coupon
  static async createCoupon(req: Request, res: Response) {
    try {
      const data = CreateCouponSchema.parse(req.body);

      // Convert code to uppercase before saving
      const normalizedCode = data.code.toUpperCase();

      // Check if coupon code already exists (case-insensitive)
      const existingCoupon = await prisma.coupon.findFirst({
        where: { 
          code: {
            equals: normalizedCode,
            mode: 'insensitive'
          }
        }
      });

      if (existingCoupon) {
        return res.status(400).json({
          success: false,
          error: 'Coupon code already exists'
        });
      }

      const coupon = await prisma.coupon.create({
        data: {
          ...data,
          code: normalizedCode,  // Save the code in uppercase
          status: 'ACTIVE',
          createdBy: req.user?.id,
          updatedBy: req.user?.id
        }
      });

      // Format currency values
      const formattedCoupon = formatCouponValues(coupon);

      return res.json({
        success: true,
        data: formattedCoupon
      });
    } catch (error) {
      console.error('Error in createCoupon:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.errors
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Failed to create coupon'
      });
    }
  }

  // Update coupon
  static async updateCoupon(req: Request, res: Response) {
    try {
      const { id } = req.params;
      console.log('Updating coupon with ID:', id);
      
      const data = UpdateCouponSchema.parse(req.body);
      console.log('Update data:', data);

      // Check if coupon exists
      const existingCoupon = await prisma.coupon.findUnique({
        where: { id }
      });

      if (!existingCoupon) {
        console.error('Coupon not found with ID:', id);
        return res.status(404).json({
          success: false,
          error: 'Coupon not found'
        });
      }

      // If updating code, check if new code already exists (case-insensitive)
      if (data.code && data.code.toUpperCase() !== existingCoupon.code) {
        const codeExists = await prisma.coupon.findFirst({
          where: { 
            code: {
              equals: data.code.toUpperCase(),
              mode: 'insensitive'
            }
          }
        });

        if (codeExists) {
          return res.status(400).json({
            success: false,
            error: 'Coupon code already exists'
          });
        }
      }

      const coupon = await prisma.coupon.update({
        where: { id },
        data: {
          ...data,
          code: data.code ? data.code.toUpperCase() : undefined,
          updatedBy: req.user?.id
        }
      });

      // Format currency values
      const formattedCoupon = formatCouponValues(coupon);
      console.log('Updated coupon:', formattedCoupon);

      return res.json({
        success: true,
        data: formattedCoupon
      });
    } catch (error) {
      console.error('Error in updateCoupon:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.errors
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Failed to update coupon'
      });
    }
  }

  // Delete coupon
  static async deleteCoupon(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if coupon exists
      const existingCoupon = await prisma.coupon.findUnique({
        where: { id }
      });

      if (!existingCoupon) {
        return res.status(404).json({
          success: false,
          error: 'Coupon not found'
        });
      }

      await prisma.coupon.delete({
        where: { id }
      });

      return res.json({
        success: true,
        message: 'Coupon deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteCoupon:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete coupon'
      });
    }
  }

  // Validate coupon
  static async validateCoupon(req: Request, res: Response) {
    try {
      const { code } = req.params;
      const { total } = req.body;

      // Convert code to uppercase for case-insensitive comparison
      const normalizedCode = code.toUpperCase();

      const coupon = await prisma.coupon.findFirst({
        where: { 
          code: {
            equals: normalizedCode,
            mode: 'insensitive'  // Make the search case-insensitive
          },
          status: 'ACTIVE',
          OR: [
            { endDate: null },
            { endDate: { gt: new Date() } }
          ],
          startDate: { lte: new Date() }
        }
      });

      if (!coupon) {
        return res.status(200).json({
          success: false,
          error: 'Invalid or expired coupon',
          data: null
        });
      }

      // Check minimum purchase amount
      if (coupon.minOrderAmount && total < coupon.minOrderAmount) {
        return res.status(200).json({
          success: false,
          error: `Minimum purchase amount of ${formatCurrency(coupon.minOrderAmount)} required`,
          data: null
        });
      }

      // Check usage limit
      if (coupon.usageLimit) {
        const usageCount = await prisma.couponUsage.count({
          where: { couponId: coupon.id }
        });
        if (usageCount >= coupon.usageLimit) {
          return res.status(200).json({
            success: false,
            error: 'Coupon usage limit reached',
            data: null
          });
        }
      }

      // Calculate discount
      let discount = 0;
      if (coupon.type === 'PERCENTAGE') {
        discount = (total * coupon.value) / 100;
        if (coupon.maxDiscount && discount > coupon.maxDiscount) {
          discount = coupon.maxDiscount;
        }
      } else {
        discount = Math.min(coupon.value, total);
      }

      return res.json({
        success: true,
        data: {
          id: coupon.id,
          code: coupon.code,  // Return the original code format from the database
          type: coupon.type,
          value: coupon.type === 'FIXED_AMOUNT' ? formatCurrency(coupon.value) : `${coupon.value}%`,
          maxDiscount: coupon.maxDiscount ? formatCurrency(coupon.maxDiscount) : null,
          discount: parseFloat(discount.toFixed(2)),
          finalTotal: parseFloat((total - discount).toFixed(2))
        }
      });
    } catch (error) {
      console.error('Error in validateCoupon:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to validate coupon',
        data: null
      });
    }
  }
}
