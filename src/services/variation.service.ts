import { CategoryType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/ApiError';
import { VariationType } from '@prisma/client';

// Define the required variations for each category
export const CATEGORY_VARIATIONS = {
  [CategoryType.CAKES]: [VariationType.SIZE, VariationType.FLAVOUR],
  [CategoryType.FLOWERS]: [VariationType.SIZE],
  [CategoryType.COMBOS]: [VariationType.FLAVOUR],
} as const;

// Interface for variation option
interface VariationOption {
  value: string;
  priceAdjustment: number;
}

// Interface for variation configuration
interface VariationConfig {
  type: VariationType;
  options: VariationOption[];
}

// Validate that a product has all required variations for its category
export function validateProductVariations(
  categoryType: CategoryType,
  variations: VariationConfig[]
): boolean {
  const requiredTypes = CATEGORY_VARIATIONS[categoryType];
  const providedTypes = variations.map(v => v.type);

  // Check if all required variation types are provided
  return requiredTypes.every(type => providedTypes.includes(type)) &&
    // Check if no extra variation types are provided
    providedTypes.every(type => requiredTypes.includes(type));
}

// Calculate final price based on selected variations
export function calculatePrice(
  basePrice: number,
  selectedOptions: { [key in VariationType]?: string },
  variations: VariationConfig[]
): number {
  let finalPrice = basePrice;

  // Add price adjustments for each selected option
  Object.entries(selectedOptions).forEach(([type, selectedValue]) => {
    const variation = variations.find(v => v.type === type);
    if (variation) {
      const option = variation.options.find(opt => opt.value === selectedValue);
      if (option) {
        finalPrice += option.priceAdjustment;
      }
    }
  });

  return finalPrice;
}

// Get available variations for a category
export function getRequiredVariations(categoryType: CategoryType): VariationType[] {
  return CATEGORY_VARIATIONS[categoryType];
}

// Example variation structure for a product
export const exampleVariations = {
  [CategoryType.CAKES]: [
    {
      type: VariationType.SIZE,
      options: [
        { value: "6 inch", priceAdjustment: 60 },    // 60 AED
        { value: "8 inch", priceAdjustment: 80 },    // 80 AED
        { value: "10 inch", priceAdjustment: 100 }   // 100 AED
      ]
    },
    {
      type: VariationType.FLAVOUR,
      options: [
        { value: "Vanilla", priceAdjustment: 60 },     // 60 AED
        { value: "Chocolate", priceAdjustment: 65 },   // 65 AED
        { value: "Red Velvet", priceAdjustment: 70 }   // 70 AED
      ]
    }
  ],
  [CategoryType.FLOWERS]: [
    {
      type: VariationType.SIZE,
      options: [
        { value: "Small", priceAdjustment: 50 },     // 50 AED
        { value: "Medium", priceAdjustment: 75 },    // 75 AED
        { value: "Large", priceAdjustment: 100 }     // 100 AED
      ]
    }
  ],
  [CategoryType.COMBOS]: [
    {
      type: VariationType.FLAVOUR,
      options: [
        { value: "Vanilla Combo", priceAdjustment: 120 },     // 120 AED
        { value: "Chocolate Combo", priceAdjustment: 130 },   // 130 AED
        { value: "Red Velvet Combo", priceAdjustment: 140 }   // 140 AED
      ]
    }
  ]
};
