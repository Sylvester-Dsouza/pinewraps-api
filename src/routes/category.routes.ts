import express from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import slugify from 'slugify';

const router = express.Router();

// Public endpoint to get active categories
router.get('/public', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: {
        isActive: true
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

    res.json({
      success: true,
      data: categories.map(category => ({
        ...category,
        productCount: category._count.products
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Get all categories
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const isActive = req.query.isActive as string;

    const where = {
      ...(search ? {
        name: {
          contains: search,
          mode: 'insensitive' as const,
        }
      } : {}),
      ...(isActive ? {
        isActive: isActive === 'true'
      } : {})
    };

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          _count: {
            select: {
              products: true
            }
          }
        }
      }),
      prisma.category.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        categories,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(new ApiError('Failed to fetch categories', 500));
  }
});

// Get single category
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      return next(new ApiError('Category not found', 404));
    }

    res.json(category);
  } catch (error) {
    next(new ApiError('Failed to fetch category', 500));
  }
});

// Create category
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, description, isActive = true } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    // Generate slug from name
    const slug = slugify(name, { lower: true });

    // Check if category with same slug exists
    const existingCategory = await prisma.category.findUnique({
      where: { slug }
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        isActive,
        createdBy: req.user?.uid,
        updatedBy: req.user?.uid,
      }
    });

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    next(new ApiError('Failed to create category', 500));
  }
});

// Update category
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const updateData: any = {};
    if (name) {
      updateData.name = name;
      updateData.slug = slugify(name, { lower: true });
    }
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    updateData.updatedBy = req.user?.uid;

    const category = await prisma.category.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    next(new ApiError('Failed to update category', 500));
  }
});

// Delete category
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.category.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(new ApiError('Failed to delete category', 500));
  }
});

export default router;
