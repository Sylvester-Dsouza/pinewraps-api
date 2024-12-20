import express from 'express';
import productRoutes from './product.routes';
import categoryRoutes from './category.routes';
import orderRoutes from './order.routes';
import couponRoutes from './coupon.routes';
import rewardRoutes from './reward.routes';
import customerRoutes from './customer.routes';
import customerAuthRoutes from './customer-auth.routes';
import adminRoutes from './admin.routes';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API routes

router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/orders', orderRoutes);
router.use('/coupons', couponRoutes);
router.use('/customers', customerRoutes);
router.use('/customer-auth', customerAuthRoutes);
router.use('/rewards', rewardRoutes);
router.use('/admins', adminRoutes);

export default router;
