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

export const CreateOrderSchema = z.object({
  // Customer Information
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string(),
  
  // Address Information (required for delivery)
  streetAddress: z.string().optional(),
  apartment: z.string().optional(),
  emirate: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().optional().default('United Arab Emirates'),
  
  // Delivery/Pickup Information
  deliveryMethod: z.enum(['DELIVERY', 'PICKUP']),
  
  // For Delivery Orders
  deliveryDate: z.string().optional(),
  deliveryTimeSlot: z.string().optional(),
  deliveryInstructions: z.string().optional(),
  
  // For Pickup Orders
  pickupDate: z.string().nullish(),
  pickupTimeSlot: z.string().nullish(),
  storeLocation: z.string().optional(),

  // Payment Information
  paymentMethod: z.nativeEnum(PaymentMethod),
  
  // Order Details
  items: z.array(OrderItemSchema),
  subtotal: z.number(),
  total: z.number(),
  
  // Optional Information
  notes: z.string().optional(),
  isGift: z.boolean().optional().default(false),
  giftMessage: z.string().optional(),
  giftRecipientName: z.string().optional(),
  giftRecipientPhone: z.string().optional(),
  
  // Points & Discounts
  pointsRedeemed: z.number().optional().default(0),
  couponCode: z.string().optional()
});

export const OrderSchema = CreateOrderSchema.extend({
  id: z.string(),
  userId: z.string(),
  customerId: z.string().optional(),
  status: z.nativeEnum(OrderStatus),
  createdAt: z.date(),
  updatedAt: z.date(),
  orderNumber: z.string().optional(),
  pointsEarned: z.number().optional(),
  giftWrapCharge: z.number().optional(),
  discountAmount: z.number().optional(),
  adminNotes: z.string().optional(),
  paymentStatus: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'AUTHORIZED', 'CAPTURED', 'CANCELLED']),
  paymentId: z.string().optional()
});

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
