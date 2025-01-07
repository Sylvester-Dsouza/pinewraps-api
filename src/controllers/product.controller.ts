import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { uploadToFirebase, deleteFromFirebase } from '../utils/upload';
import { prisma } from '../lib/prisma';
import { ProductStatus, VariationType } from '@prisma/client';
import { createProductSchema, updateProductSchema } from '../schemas/product.schema';
import crypto from 'crypto';
import { generateSlug, ensureUniqueSlug } from '../utils/helpers';
import { nanoid } from 'nanoid';
import { normalizeVariantCombinations, parseVariantCombinations } from '../utils/product';

// Function to generate a unique ID
const generateId = () => crypto.randomBytes(8).toString('hex');

// Create a new product
export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('Received product data:', req.body);

    const baseSlug = generateSlug(req.body.name);
    const slug = await ensureUniqueSlug(baseSlug);

    // Process the data without additional parsing
    const productData = {
      id: generateId(),
      name: req.body.name,
      description: req.body.description || '',
      sku: req.body.sku,
      slug,
      categoryId: req.body.categoryId,
      status: req.body.status || 'DRAFT',
      createdBy: req.user?.uid,
      basePrice: typeof req.body.basePrice === 'string' 
        ? parseFloat(req.body.basePrice) 
        : Number(req.body.basePrice || 0)
    };

    // Handle variations if present
    if (Array.isArray(req.body.variations)) {
      productData.variations = {
        create: req.body.variations.map((variation: any) => ({
          id: generateId(),
          type: variation.type,
          options: {
            create: variation.options.map((option: any) => ({
              id: generateId(),
              value: option.value,
              priceAdjustment: Number(option.priceAdjustment || 0),
              stock: Number(option.stock || 0)
            }))
          }
        }))
      };
    }

    // Handle combinations if present
    if (req.body.combinations) {
      // Only store combinations if we have multiple variations
      const hasMultipleVariations = Array.isArray(req.body.variations) && req.body.variations.length > 1;
      productData.variantCombinations = hasMultipleVariations 
        ? (typeof req.body.combinations === 'string'
            ? req.body.combinations
            : JSON.stringify(req.body.combinations))
        : '[]';
    }

    console.log('Processed product data:', productData);

    // Validate required fields
    if (!productData.name || !productData.categoryId) {
      return next(new ApiError('Name and category ID are required', 400));
    }

    // Verify that the category exists and is active
    const categoryExists = await prisma.category.findFirst({
      where: {
        id: productData.categoryId,
        isActive: true
      }
    });
    
    if (!categoryExists) {
      return next(new ApiError('Invalid or inactive category', 400));
    }

    // Create the product in the database
    const product = await prisma.product.create({
      data: productData,
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        variations: {
          include: {
            options: true
          }
        },
        images: {
          select: {
            id: true,
            url: true,
            alt: true
          }
        }
      }
    });

    // Handle image upload if files are present
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length) {
      try {
        console.log('Processing image uploads for product:', {
          productId: product.id,
          numberOfFiles: files.length
        });
        
        // Upload images to Firebase
        const uploadPromises = files.map(async (file, index) => {
          try {
            console.log(`Processing file ${index + 1}/${files.length}:`, {
              filename: file.originalname,
              size: file.size,
              mimetype: file.mimetype,
              bufferLength: file.buffer?.length
            });

            const imageId = generateId();
            // Clean the filename more thoroughly
            const cleanFileName = file.originalname
              .toLowerCase()
              .replace(/[^a-z0-9.-]/g, '-')
              .replace(/-+/g, '-');
            const filePath = `products/${product.id}/${imageId}-${cleanFileName}`;
            
            console.log('Generated file path:', filePath);
            const uploadResult = await uploadToFirebase(file, filePath);
            console.log('Upload successful for file:', {
              filename: file.originalname,
              url: uploadResult.url,
              path: uploadResult.path
            });

            return {
              id: imageId,
              url: uploadResult.url,
              alt: file.originalname,
              productId: product.id
            };
          } catch (error) {
            const err = error as Error;
            console.error(`Error processing file ${index + 1}/${files.length}:`, {
              filename: file.originalname,
              error: err.message,
              stack: err.stack
            });
            throw error;
          }
        });

        console.log('Waiting for all uploads to complete...');
        const uploadedImages = await Promise.all(uploadPromises);
        console.log('All uploads completed successfully:', {
          numberOfImages: uploadedImages.length,
          images: uploadedImages.map(img => ({ id: img.id, url: img.url }))
        });

        // Create image records in the database
        console.log('Creating database records for images...');
        await prisma.productImage.createMany({
          data: uploadedImages.map(image => ({
            id: generateId(),
            productId: product.id,
            url: image.url,
            alt: image.alt || undefined,
            isPrimary: false
          }))
        });
        console.log('Database records created successfully');

        // Get the updated product with images
        const updatedProduct = await prisma.product.findUnique({
          where: { id: product.id },
          include: {
            category: true,
            images: true,
            variations: {
              include: {
                options: true
              }
            }
          }
        });

        if (!updatedProduct) {
          throw new ApiError('Product not found after image upload', 404);
        }

        // Format the response
        const formattedProduct = {
          ...updatedProduct,
          variations: updatedProduct.variations || [],
          variantCombinations: typeof updatedProduct.variantCombinations === 'string'
            ? updatedProduct.variantCombinations
            : JSON.stringify(updatedProduct.variantCombinations || [])
        };

        return res.status(201).json({
          success: true,
          data: {
            product: formattedProduct
          }
        });
      } catch (error) {
        console.error('Error uploading images:', error);
        
        // Delete the product if image upload fails
        try {
          console.log('Rolling back - deleting product:', product.id);
          await prisma.product.delete({ where: { id: product.id } });
          console.log('Product deleted successfully');
        } catch (deleteError) {
          console.error('Error deleting product during rollback:', deleteError);
        }
        
        throw new ApiError('Failed to upload product images', 500);
      }
    }

    // Return the product without images if no files were uploaded
    const formattedProduct = {
      ...product,
      variations: product.variations || [],
      variantCombinations: typeof product.variantCombinations === 'string'
        ? product.variantCombinations
        : JSON.stringify(product.variantCombinations || [])
    };

    return res.status(201).json({
      success: true,
      data: {
        product: formattedProduct
      }
    });
  } catch (error) {
    console.error('Error creating product:', error);
    return next(new ApiError('Failed to create product', 500));
  }
};

// Helper function to get or create default category
async function getDefaultCategory() {
  const defaultCategory = await prisma.category.findFirst({
    where: { name: 'Uncategorized' }
  });

  if (defaultCategory) {
    return defaultCategory;
  }

  return await prisma.category.create({
    data: {
      name: 'Uncategorized',
      description: null
    }
  });
}

// Get all products with filters
export async function getAllProducts(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    console.log('Fetching products with params:', { page, limit, skip, status });
    console.log('Auth user:', req.user);

    const where: any = {
      status: status ? status : {
        not: ProductStatus.DELETED
      }
    };

    // Add search filter if provided
    if (req.query.search) {
      where.OR = [
        { name: { contains: req.query.search as string, mode: 'insensitive' } },
        { sku: { contains: req.query.search as string, mode: 'insensitive' } },
      ];
    }

    try {
      console.log('Executing database query with where:', where);
      // Get products with pagination
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: limit,
          include: {
            category: true,
            images: true,
            variations: {
              include: {
                options: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }),
        prisma.product.count({ where })
      ]);

      console.log('Query results:', {
        productsFound: products.length,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      });

      // Format the products to include combinations
      const formattedProducts = products.map(product => {
        let combinations = [];
        try {
          combinations = typeof product.variantCombinations === 'string' 
            ? JSON.parse(product.variantCombinations) 
            : product.variantCombinations || [];
        } catch (error) {
          console.error('Error parsing combinations for product:', product.id, error);
        }
        return {
          ...product,
          variations: product.variations || [],
          variantCombinations: combinations
        };
      });

      return res.json({
        success: true,
        data: {
          products: formattedProducts,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Return empty data with error message
      return res.status(500).json({
        success: false,
        message: 'Database error occurred',
        data: {
          products: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0
          }
        }
      });
    }
  } catch (error) {
    console.error('Get products error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'GET_PRODUCTS_ERROR',
        message: 'Failed to get products'
      }
    });
  }
};

// Get product by ID
export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    console.log('Fetching product by ID:', id);

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        images: true,
        variations: {
          include: {
            options: true
          }
        }
      }
    });

    console.log('Found product:', product ? 'yes' : 'no');

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Format the response to match the expected structure
    const formattedProduct = {
      ...product,
      variations: product.variations || [],
      variantCombinations: typeof product.variantCombinations === 'string'
        ? product.variantCombinations
        : JSON.stringify(product.variantCombinations || [])
    };

    return res.json({
      success: true,
      data: formattedProduct
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return next(new ApiError('Failed to fetch product', 500));
  }
};

// Update product
export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    console.log('Updating product:', id);
    console.log('Update data:', req.body);

    // Validate update data
    const validatedData = updateProductSchema.parse(req.body);

    // Handle image deletions first
    if (req.body.deletedImages && Array.isArray(req.body.deletedImages)) {
      console.log('Deleting images:', req.body.deletedImages);
      
      // Delete images from Firebase and database using a transaction with increased timeout
      await prisma.$transaction(async (tx) => {
        // First, fetch all images that need to be deleted
        const imagesToDelete = await tx.productImage.findMany({
          where: {
            id: {
              in: req.body.deletedImages
            }
          }
        });

        console.log(`Found ${imagesToDelete.length} images to delete`);

        // Delete from Firebase in parallel
        await Promise.allSettled(
          imagesToDelete.map(async (image) => {
            try {
              await deleteFromFirebase(image.url);
              console.log(`Deleted from Firebase: ${image.url}`);
            } catch (error) {
              console.error(`Error deleting from Firebase: ${image.url}`, error);
              // Continue with database deletion even if Firebase fails
            }
          })
        );

        // Delete all images from database in a single query
        if (imagesToDelete.length > 0) {
          await tx.productImage.deleteMany({
            where: {
              id: {
                in: imagesToDelete.map(img => img.id)
              }
            }
          });
          console.log(`Successfully deleted ${imagesToDelete.length} images from database`);
        }
      }, {
        timeout: 10000 // Increase timeout to 10 seconds
      });
    }

    // If name is being updated, generate new slug
    if (validatedData.name) {
      const baseSlug = generateSlug(validatedData.name);
      validatedData.slug = await ensureUniqueSlug(baseSlug, id);
      console.log('Generated new slug:', validatedData.slug);
    }

    // Update the product
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name: validatedData.name,
        slug: validatedData.slug,
        description: validatedData.description,
        basePrice: validatedData.basePrice,
        sku: validatedData.sku,
        categoryId: validatedData.categoryId,
        status: validatedData.status,
        updatedBy: req.user?.uid,
        variations: {
          deleteMany: {},
          create: validatedData.variations?.map(variation => ({
            id: nanoid(),
            type: variation.type,
            options: {
              create: variation.options?.map(option => ({
                id: nanoid(),
                value: option.value,
                priceAdjustment: option.priceAdjustment || 0,
                stock: option.stock || 0
              })) || []
            }
          })) || []
        },
        variantCombinations: typeof validatedData.combinations === 'string'
          ? validatedData.combinations
          : JSON.stringify(validatedData.combinations || [])
      },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        variations: {
          include: {
            options: true
          }
        },
        images: true
      }
    });

    // Format the response
    const formattedProduct = {
      ...updatedProduct,
      variations: updatedProduct.variations || [],
      variantCombinations: typeof updatedProduct.variantCombinations === 'string'
        ? updatedProduct.variantCombinations
        : JSON.stringify(updatedProduct.variantCombinations || [])
    };

    return res.json({
      success: true,
      data: formattedProduct
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return next(new ApiError('Failed to update product', 500));
  }
};

// Delete product
export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  try {
    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    // First, check if the product exists
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        variations: {
          include: {
            options: true
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    try {
      // Delete the product and all related data using transactions
      await prisma.$transaction([
        // Delete variation options
        prisma.productVariationOption.deleteMany({
          where: {
            variation: {
              productId: id
            }
          }
        }),
        // Delete variations
        prisma.productVariation.deleteMany({
          where: { productId: id }
        }),
        // Delete images from database
        prisma.productImage.deleteMany({
          where: { productId: id }
        }),
        // Delete the product
        prisma.product.delete({
          where: { id }
        })
      ]);

      // After successful database deletion, delete images from storage
      if (product.images?.length > 0) {
        await Promise.all(
          product.images.map(image => 
            deleteFromFirebase(image.url).catch(error => {
              console.error(`Error deleting image ${image.url} from storage:`, error);
            })
          )
        );
      }

      return res.json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      console.error('Transaction error:', error);
      return next(new ApiError('Failed to delete product', 500));
    }
  } catch (error) {
    console.error('Error in deleteProduct:', error);
    return next(new ApiError('Failed to delete product', 500));
  }
};

// Restore product
export const restoreProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null
      },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        images: {
          select: {
            id: true,
            url: true
          }
        }
      }
    });
    res.json(product);
  } catch (error) {
    throw new ApiError('Error restoring product', 500);
  }
};

// Permanently delete product
export const permanentlyDeleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  try {
    await prisma.product.delete({
      where: { id }
    });
    res.json({ message: 'Product permanently deleted' });
  } catch (error) {
    throw new ApiError('Error permanently deleting product', 500);
  }
};

// Upload product images
export const uploadProductImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    console.log('Files received:', req.files);

    const productId = req.params.id;
    if (!productId) {
      console.error('No product ID provided');
      throw new ApiError('Product ID is required', 400);
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      console.error(`Product not found with ID: ${productId}`);
      throw new ApiError('Product not found', 404);
    }

    // Check if files exist and are properly formatted
    if (!req.files) {
      console.error('No files in request');
      throw new ApiError('No files uploaded', 400);
    }

    const files = Array.isArray(req.files) ? req.files : [req.files];
    
    if (files.length === 0) {
      console.error('Files array is empty');
      throw new ApiError('No files uploaded', 400);
    }

    console.log(`Processing ${files.length} files:`, files.map(f => ({
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size
    })));

    // Validate each file
    files.forEach((file, index) => {
      if (!file.buffer || !file.originalname) {
        console.error(`Invalid file at index ${index}:`, file);
        throw new ApiError(`Invalid file format for file ${index + 1}`, 400);
      }
      
      // Validate file type
      if (!file.mimetype.startsWith('image/')) {
        throw new ApiError(`File ${index + 1} is not an image`, 400);
      }
    });

    // Upload all files to Firebase with product-specific path
    const uploadPromises = files.map(async (file, index) => {
      try {
        const customPath = `products/${productId}/${generateId()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        console.log(`Uploading file ${index + 1} to path: ${customPath}`);
        return await uploadToFirebase(file, customPath);
      } catch (error) {
        console.error(`Error uploading file ${index + 1}:`, error);
        throw new ApiError(`Failed to upload file ${index + 1}`, 500);
      }
    });

    const uploadedImages = await Promise.all(uploadPromises);
    console.log('Successfully uploaded images:', uploadedImages);

    // Save image records to database
    const imageRecords = await prisma.productImage.createMany({
      data: uploadedImages.map(image => ({
        id: generateId(),
        productId,
        url: image.url,
        alt: image.originalname || undefined,
        isPrimary: false
      }))
    });

    console.log('Created image records:', imageRecords);

    // Return the uploaded image data
    res.json({
      success: true,
      message: 'Images uploaded successfully',
      data: uploadedImages
    });
  } catch (error) {
    console.error('Error in uploadProductImage:', error);
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      next(error);
    }
  }
};

// Get all public products
export const getPublicProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('Fetching public products with query:', req.query);
    
    const { categoryId, status } = req.query;

    const where = {
      status: status || 'ACTIVE',
      ...(categoryId ? { categoryId: String(categoryId) } : {})
    };

    console.log('Database query:', where);

    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        images: true,
        variations: {
          include: {
            options: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${products.length} products${categoryId ? ` for category ${categoryId}` : ''}`);
    console.log('Product categories:', products.map(p => ({ name: p.name, categoryId: p.categoryId })));

    if (!products || products.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    return res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error fetching public products:', error);
    return next(new ApiError('Failed to fetch products', 500));
  }
};

// Get public product by ID or slug
export const getPublicProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    console.log('Fetching public product by ID or slug:', id);

    // First try to find by exact slug match
    let product = await prisma.product.findFirst({
      where: {
        OR: [
          { id },
          { slug: id },
          { slug: id.toLowerCase() } // Also try lowercase version
        ],
        status: 'ACTIVE'
      },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        images: true,
        variations: {
          include: {
            options: true
          }
        }
      }
    });

    if (!product) {
      console.log('Product not found:', id);
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Parse variant combinations
    let combinations = [];
    try {
      combinations = typeof product.variantCombinations === 'string'
        ? JSON.parse(product.variantCombinations)
        : product.variantCombinations || [];
    } catch (error) {
      console.error('Error parsing combinations:', error);
    }

    // Format the response
    const formattedProduct = {
      ...product,
      variations: product.variations || [],
      variantCombinations: combinations
    };

    return res.json({
      success: true,
      data: formattedProduct
    });
  } catch (error) {
    console.error('Error fetching public product:', error);
    return next(new ApiError('Failed to fetch product', 500));
  }
};

// Get product analytics
export const getProductAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const [
      totalProducts,
      activeProducts,
      draftProducts,
      totalCategories
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.product.count({ where: { status: 'DRAFT' } }),
      prisma.category.count()
    ]);

    res.json({
      success: true,
      data: {
        totalProducts,
        activeProducts,
        draftProducts,
        totalCategories
      }
    });
  } catch (error) {
    next(error);
  }
};
