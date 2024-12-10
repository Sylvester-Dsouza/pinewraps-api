import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { prisma } from '../lib/prisma';

const DEFAULT_CATEGORIES = [
  { 
    name: 'Cakes', 
    description: 'Delicious custom cakes for all occasions'
  },
  { 
    name: 'Flowers', 
    description: 'Beautiful floral arrangements'
  },
  { 
    name: 'Combos', 
    description: 'Special combinations of cakes and flowers'
  }
];

// Initialize fixed categories if they don't exist
export const initializeCategories = async () => {
  try {
    // Always ensure our default categories exist and are active
    for (const category of DEFAULT_CATEGORIES) {
      await prisma.category.upsert({
        where: { name: category.name },
        update: { 
          description: category.description,
          deletedAt: null // Ensure the category is not soft-deleted
        },
        create: {
          name: category.name,
          description: category.description
        }
      });
    }
    console.log('Categories verified successfully');
  } catch (error) {
    console.error('Error initializing categories:', error);
  }
};

// Get all categories
export const getAllCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categories = await prisma.category.findMany({
      where: {
        deletedAt: null
      },
      orderBy: {
        name: 'asc'
      },
      include: {
        _count: {
          select: {
            products: true
          }
        }
      }
    });

    const formattedCategories = categories.map(category => ({
      ...category,
      productCount: category._count.products
    }));

    res.json({
      success: true,
      data: formattedCategories
    });
  } catch (error) {
    next(error);
  }
};

// Create a new category
export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      throw new ApiError('Category name is required', 400);
    }

    const existingCategory = await prisma.category.findUnique({
      where: { name }
    });

    if (existingCategory && !existingCategory.deletedAt) {
      throw new ApiError('Category with this name already exists', 400);
    }

    // If category was soft deleted, restore it
    if (existingCategory && existingCategory.deletedAt) {
      const category = await prisma.category.update({
        where: { id: existingCategory.id },
        data: {
          description,
          deletedAt: null,
          updatedAt: new Date()
        }
      });

      return res.status(200).json({
        success: true,
        data: category
      });
    }

    const category = await prisma.category.create({
      data: {
        name,
        description
      }
    });

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

// Get category by ID
export const getCategoryById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        products: true,
        _count: {
          select: {
            products: true
          }
        }
      }
    });

    if (!category || category.deletedAt) {
      throw new ApiError('Category not found', 404);
    }

    res.json({
      success: true,
      data: {
        ...category,
        productCount: category._count.products
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update category
export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const existingCategory = await prisma.category.findUnique({
      where: { id }
    });

    if (!existingCategory || existingCategory.deletedAt) {
      throw new ApiError('Category not found', 404);
    }

    if (name && name !== existingCategory.name) {
      const nameExists = await prisma.category.findFirst({
        where: {
          name,
          id: { not: id },
          deletedAt: null
        }
      });

      if (nameExists) {
        throw new ApiError('Category with this name already exists', 400);
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: name || undefined,
        description: description || undefined,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

// Delete category
export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id }
    });

    if (!category || category.deletedAt) {
      throw new ApiError('Category not found', 404);
    }

    // Check if this is a default category
    const isDefaultCategory = DEFAULT_CATEGORIES.some(
      defaultCat => defaultCat.name.toLowerCase() === category.name.toLowerCase()
    );

    if (isDefaultCategory) {
      throw new ApiError('Cannot delete default categories (Cakes, Flowers, Combos)', 403);
    }

    // Soft delete the category
    await prisma.category.update({
      where: { id },
      data: {
        deletedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
