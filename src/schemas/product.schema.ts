import { z } from 'zod';
import { ProductStatus, VariationType } from '@prisma/client';
import { nanoid } from 'nanoid';

// Helper for number validation with string support
const numberSchema = z.preprocess((val) => {
  if (typeof val === 'string') {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  }
  return val;
}, z.number().min(0));

const variantOptionSchema = z.object({
  value: z.string(),
  priceAdjustment: numberSchema.optional().default(0),
  stock: numberSchema.optional().default(0)
});

const variationSchema = z.object({
  type: z.nativeEnum(VariationType),
  options: z.array(variantOptionSchema)
});

const variantCombinationSchema = z.object({
  size: z.string(),
  flavour: z.string(),
  price: numberSchema.optional().default(0)
});

const productBase = {
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  basePrice: numberSchema,
  sku: z.string().min(1, 'SKU is required'),
  categoryId: z.string().min(1, 'Category ID is required'),
  status: z.nativeEnum(ProductStatus).default(ProductStatus.DRAFT),
  variations: z.array(variationSchema).optional().nullable().default([]),
  combinations: z.union([
    z.array(variantCombinationSchema),
    z.string().transform(str => {
      try {
        return JSON.parse(str);
      } catch {
        return [];
      }
    })
  ]).optional().nullable().default([]),
  // SEO fields
  metaTitle: z.string().max(60, 'Meta title must be less than 60 characters').optional().nullable(),
  metaDescription: z.string().max(160, 'Meta description must be less than 160 characters').optional().nullable(),
  metaKeywords: z.string().optional().nullable(),
};

export const createProductSchema = z.object({
  ...productBase,
  sku: z.string().optional().default(() => nanoid(10)),
  status: z.union([
    z.nativeEnum(ProductStatus),
    z.string().transform(val => val as ProductStatus)
  ]).optional().default(ProductStatus.DRAFT),
  variations: z.union([
    z.array(variationSchema),
    z.string().transform((str) => {
      try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })
  ]).optional().nullable().default([]),
  combinations: z.union([
    z.array(variantCombinationSchema),
    z.string().transform((str) => {
      try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })
  ]).optional().nullable().default([])
}).passthrough();

export const updateProductSchema = z.object({
  ...productBase,
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional().nullable(),
  basePrice: numberSchema.optional(),
  sku: z.string().min(1, 'SKU is required').optional(),
  categoryId: z.string().min(1, 'Category ID is required').optional(),
  status: z.union([
    z.nativeEnum(ProductStatus),
    z.string().transform(val => val as ProductStatus)
  ]).optional(),
  variations: z.union([
    z.array(variationSchema),
    z.string().transform((str) => {
      try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })
  ]).optional().nullable(),
  variantCombinations: z.union([
    z.array(variantCombinationSchema),
    z.string().transform((str) => {
      try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })
  ]).optional().nullable(),
  combinations: z.union([
    z.array(variantCombinationSchema),
    z.string().transform((str) => {
      try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })
  ]).optional().nullable(),
  existingImages: z.array(z.string()).optional(),
  deletedImages: z.array(z.string()).optional()
}).passthrough();

export const productFilterSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.nativeEnum(ProductStatus).optional(),
  categoryId: z.string().optional(),
  search: z.string().optional(),
}).strict();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductFilter = z.infer<typeof productFilterSchema>;
