import { z } from 'zod';

export const CouponSchema = z.object({
  code: z.string().min(3).max(20),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  discountValue: z.number().min(0),
  minPurchaseAmount: z.number().min(0).default(0),
  maxDiscountAmount: z.number().min(0).optional(),
  startDate: z.date(),
  endDate: z.date(),
  isActive: z.boolean().default(true),
  usageLimit: z.number().min(0).optional(),
  currentUsage: z.number().min(0).default(0),
});

export const CreateCouponSchema = CouponSchema.omit({ currentUsage: true });
export const UpdateCouponSchema = CreateCouponSchema.partial();

export type Coupon = z.infer<typeof CouponSchema>;
export type CreateCoupon = z.infer<typeof CreateCouponSchema>;
export type UpdateCoupon = z.infer<typeof UpdateCouponSchema>;
