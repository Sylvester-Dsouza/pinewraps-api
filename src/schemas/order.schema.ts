import { z } from 'zod';
import { OrderStatus, PaymentMethod, DeliveryType } from '@prisma/client';

export const OrderItemSchema = z.object({
  name: z.string(),
  variant: z.string().optional(),
  price: z.number().positive(),
  quantity: z.number().int().positive(),
  cakeWriting: z.string().optional()
});

export const CreateOrderSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string(),
  address: z.string(),
  apartment: z.string().optional().default('N/A'),
  emirate: z.string(),
  pincode: z.string().optional(),
  items: z.array(OrderItemSchema),
  deliveryMethod: z.enum(['delivery', 'pickup']),
  deliveryDate: z.string(),
  deliveryTime: z.string(),
  deliveryFee: z.number(),
  giftWrapCharge: z.number(),
  couponCode: z.string().optional(),
  couponDiscount: z.number().optional(),
  total: z.number(),
  isGift: z.boolean().default(false),
  paymentMethod: z.enum(['cod', 'card', 'bank'])
});

export const UpdateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus)
});

export const UpdateAdminNotesSchema = z.object({
  adminNotes: z.string()
});

export const SendEmailSchema = z.object({
  subject: z.string(),
  body: z.string()
});
