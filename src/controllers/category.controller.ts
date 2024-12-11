import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { generateSlug } from '../utils/slug';
import { ApiError } from '../utils/api-error';

const CategoryController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await prisma.category.findMany({
        where: {
          isActive: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return res.json(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      next(new ApiError(500, 'Failed to fetch categories'));
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, description } = req.body;
      const userId = req.user?.id;

      // Generate slug from name
      const slug = generateSlug(name);

      const category = await prisma.category.create({
        data: {
          id: slug,
          name,
          description,
          slug,
          createdBy: userId,
          updatedBy: userId
        }
      });

      return res.json(category);
    } catch (error) {
      console.error('Error creating category:', error);
      next(new ApiError(500, 'Failed to create category'));
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;
      const userId = req.user?.id;

      // Generate new slug if name is changed
      const updateData: any = {
        updatedBy: userId
      };

      if (name) {
        updateData.name = name;
        updateData.slug = generateSlug(name);
      }

      if (description !== undefined) {
        updateData.description = description;
      }

      if (isActive !== undefined) {
        updateData.isActive = isActive;
      }

      const category = await prisma.category.update({
        where: { id },
        data: updateData
      });

      return res.json(category);
    } catch (error) {
      console.error('Error updating category:', error);
      next(new ApiError(500, 'Failed to update category'));
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      await prisma.category.delete({
        where: { id }
      });

      return res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      console.error('Error deleting category:', error);
      next(new ApiError(500, 'Failed to delete category'));
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          products: {
            where: {
              status: 'ACTIVE'
            },
            select: {
              id: true,
              name: true,
              status: true,
              basePrice: true,
              sku: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });

      if (!category) {
        throw new ApiError(404, 'Category not found');
      }

      return res.json(category);
    } catch (error) {
      console.error('Error fetching category:', error);
      next(new ApiError(500, 'Failed to fetch category'));
    }
  }
};

export default CategoryController;
