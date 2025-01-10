import { z } from 'zod';

// Enums for order status and delivery type
export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER'
}

export enum Emirates {
  ABU_DHABI = 'ABU_DHABI',
  DUBAI = 'DUBAI',
  SHARJAH = 'SHARJAH',
  AJMAN = 'AJMAN',
  UMM_AL_QUWAIN = 'UMM_AL_QUWAIN',
  RAS_AL_KHAIMAH = 'RAS_AL_KHAIMAH',
  FUJAIRAH = 'FUJAIRAH'
}

export enum RewardTier {
  GREEN = 'GREEN',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM'
}

export enum RewardHistoryType {
  EARNED = 'EARNED',
  REDEEMED = 'REDEEMED',
  FAILED = 'FAILED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  CANCELLED = 'CANCELLED'
}

export const DeliveryType = {
  DELIVERY: 'DELIVERY',
  PICKUP: 'PICKUP'
} as const;

// Validation schemas
export const OrderItemSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  variant: z.string(),
  price: z.number(),
  quantity: z.number(),
  cakeWriting: z.string().optional()
});

export const AddressSchema = z.object({
  streetAddress: z.string(),
  apartment: z.string().optional(),
  emirate: z.string(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().optional().default('United Arab Emirates')
});

// Base schemas for common fields
const BaseOrderSchema = z.object({
  idempotencyKey: z.string().optional(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  items: z.array(z.object({
    name: z.string(),
    variant: z.string(),
    price: z.number(),
    quantity: z.number(),
    cakeWriting: z.string().nullable()
  })),
  subtotal: z.number(),
  isGift: z.boolean().default(false),
  giftMessage: z.string().nullable(),
  giftRecipientName: z.string().nullable(),
  giftRecipientPhone: z.string().nullable(),
  notes: z.string().nullable(),
  couponCode: z.string().nullable(),
  pointsRedeemed: z.number().default(0)
});

// Schema for delivery orders
const DeliveryOrderSchema = BaseOrderSchema.extend({
  deliveryMethod: z.literal('DELIVERY'),
  deliveryDate: z.string(),
  deliveryTimeSlot: z.string(),
  deliveryInstructions: z.string().nullable(),
  streetAddress: z.string(),
  apartment: z.string(),
  emirate: z.string(),
  city: z.string(),
  pincode: z.string(),
  deliveryCharge: z.number(),
});

// Schema for pickup orders
const PickupOrderSchema = BaseOrderSchema.extend({
  deliveryMethod: z.literal('PICKUP'),
  pickupDate: z.string(),
  pickupTimeSlot: z.string(),
  storeLocation: z.string(),
  deliveryCharge: z.null(),
});

export const CreateOrderSchema = z.discriminatedUnion('deliveryMethod', [
  DeliveryOrderSchema,
  PickupOrderSchema
]);

// Extended schemas with additional fields
const DeliveryOrderSchemaWithId = DeliveryOrderSchema.extend({
  id: z.string(),
  userId: z.string(),
  status: z.nativeEnum(OrderStatus),
  createdAt: z.date(),
  updatedAt: z.date(),
  orderNumber: z.string().optional(),
  pointsEarned: z.number().optional(),
  giftWrapCharge: z.number().optional(),
  discountAmount: z.number().optional(),
  adminNotes: z.string().optional(),
  paymentStatus: z.nativeEnum(PaymentStatus),
  paymentId: z.string().optional()
});

const PickupOrderSchemaWithId = PickupOrderSchema.extend({
  id: z.string(),
  userId: z.string(),
  status: z.nativeEnum(OrderStatus),
  createdAt: z.date(),
  updatedAt: z.date(),
  orderNumber: z.string().optional(),
  pointsEarned: z.number().optional(),
  giftWrapCharge: z.number().optional(),
  discountAmount: z.number().optional(),
  adminNotes: z.string().optional(),
  paymentStatus: z.nativeEnum(PaymentStatus),
  paymentId: z.string().optional()
});

export const OrderSchema = z.discriminatedUnion('deliveryMethod', [
  DeliveryOrderSchemaWithId,
  PickupOrderSchemaWithId
]);

// Query schemas
export const GetOrdersQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
  status: z.enum(['all', ...Object.values(OrderStatus)]).default('all'),
  search: z.string().optional()
});

export const GetAnalyticsQuerySchema = z.object({
  timeRange: z.enum(['7d', '14d', '30d', '3m', 'all']).default('7d')
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

// Types derived from schemas
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type Address = z.infer<typeof AddressSchema>;
export type Customer = z.infer<typeof AddressSchema>;
export type Delivery = z.infer<typeof CreateOrderSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
