import express from 'express';
import { CouponController } from '../controllers/coupon.controller';
import { requireAuth } from '../middleware/auth';
import { ApiError } from '../lib/error';

const router = express.Router();

// Admin routes (requires authentication)
router.get('/', requireAuth, CouponController.getCoupons);
router.post('/', requireAuth, CouponController.createCoupon);
router.get('/:id', requireAuth, CouponController.getCoupon);
router.put('/:id', requireAuth, CouponController.updateCoupon);
router.delete('/:id', requireAuth, CouponController.deleteCoupon);

// Public route for validating coupons
router.post('/:code/validate', CouponController.validateCoupon);

export default router;
