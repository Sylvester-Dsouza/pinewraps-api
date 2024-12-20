import express from 'express';
import multer from 'multer';
import { 
  createProduct, 
  getAllProducts, 
  getProductById,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  getPublicProducts,
  getPublicProductById,
  getProductAnalytics
} from '../controllers/product.controller';
import { requireAuth } from '../middleware/auth';
import { parseFormData } from '../middleware/parse-form-data';
import { createProductSchema, updateProductSchema } from '../schemas/product.schema';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10 // Max 10 files
  }
});

// Public routes
router.get('/public', getPublicProducts);
router.get('/public/:id', getPublicProductById);

// Protected routes
router.get('/', requireAuth, getAllProducts);
router.get('/analytics', requireAuth, getProductAnalytics);
router.get('/:id', requireAuth, getProductById);

// Create product - separate endpoints for data and images
router.post('/', 
  requireAuth,
  upload.array('images', 5),
  parseFormData(),
  createProduct
);
router.post('/:id/media', 
  requireAuth, 
  upload.array('images', 5),
  uploadProductImage
);

// Update product - support both PUT and PATCH
const updateMiddleware = [
  requireAuth,
  (req, res, next) => {
    try {
      // Log raw request body for debugging
      console.log('Raw request body:', req.body);

      // Parse JSON strings back to objects
      if (typeof req.body.variations === 'string') {
        try {
          req.body.variations = JSON.parse(req.body.variations);
        } catch (e) {
          req.body.variations = [];
        }
      }
      if (typeof req.body.specifications === 'string') {
        try {
          req.body.specifications = JSON.parse(req.body.specifications);
        } catch (e) {
          req.body.specifications = {};
        }
      }
      if (typeof req.body.tags === 'string') {
        try {
          req.body.tags = JSON.parse(req.body.tags);
        } catch (e) {
          req.body.tags = [];
        }
      }
      if (typeof req.body.existingImages === 'string') {
        try {
          req.body.existingImages = JSON.parse(req.body.existingImages);
        } catch (e) {
          req.body.existingImages = [];
        }
      }

      // Convert numeric fields
      if (req.body.basePrice) {
        req.body.basePrice = Number(req.body.basePrice);
      }

      // Log processed request body
      console.log('Processed request body:', req.body);

      next();
    } catch (error) {
      console.error('Error processing request body:', error);
      res.status(400).json({
        error: 'Failed to process request data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },
  updateProduct
];

router.put('/:id',
  requireAuth,
  upload.array('images', 5),
  parseFormData(),
  updateMiddleware
);

router.patch('/:id',
  requireAuth,
  upload.array('images', 5),
  parseFormData(),
  updateMiddleware
);

// Delete product
router.delete('/:id', requireAuth, deleteProduct);

export default router;
