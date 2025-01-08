import express from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import slugify from 'slugify';

const router = express.Router();

// Get all categories for admin
router.get('/all', requireAuth, async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        parent: true,
        children: true,
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

// Get categories with pagination
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
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch categories' 
    });
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
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch category' 
    });
  }
});

// Create category
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, description, isActive = true, parentId } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    // Generate slug from name
    const slug = slugify(name, { lower: true });

    // Check if parent category exists if parentId is provided
    if (parentId) {
      const parentCategory = await prisma.category.findUnique({
        where: { id: parentId }
      });

      if (!parentCategory) {
        return res.status(400).json({
          success: false,
          message: 'Parent category not found'
        });
      }
    }

    const category = await prisma.category.create({
      data: {
        name,
        description,
        slug,
        isActive,
        parentId
      }
    });

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create category' 
    });
  }
});

// Update category
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isActive, parentId } = req.body;

    const updates: any = {};
    if (name !== undefined) {
      updates.name = name;
      updates.slug = slugify(name, { lower: true });
    }
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.isActive = isActive;
    if (parentId !== undefined) {
      // Check if parent category exists
      if (parentId) {
        const parentCategory = await prisma.category.findUnique({
          where: { id: parentId }
        });

        if (!parentCategory) {
          return res.status(400).json({
            success: false,
            message: 'Parent category not found'
          });
        }
      }
      updates.parentId = parentId;
    }

    const category = await prisma.category.update({
      where: { id },
      data: updates
    });

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update category' 
    });
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
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete category' 
    });
  }
});

export default router;
