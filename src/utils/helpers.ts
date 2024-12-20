import { prisma } from '../lib/prisma';

// Function to generate a slug from product name
export const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

// Function to ensure unique slug
export const ensureUniqueSlug = async (baseSlug: string, productId?: string): Promise<string> => {
  let slug = baseSlug;
  let counter = 1;
  
  while (true) {
    const existingProduct = await prisma.product.findFirst({
      where: {
        slug,
        id: { not: productId }, // Exclude current product when updating
      },
    });
    
    if (!existingProduct) break;
    
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
};
