import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

// Admin routes (requires admin privileges)
router.get('/analytics', requireAuth, requireAdmin, OrderController.getAnalytics);
router.get('/export', requireAuth, requireAdmin, OrderController.exportOrders);
router.get('/', requireAuth, OrderController.getOrders);
router.get('/:orderId', requireAuth, OrderController.getOrder);
router.get('/:orderId/snapshot', requireAuth, OrderController.getOrderSnapshot);

// Customer routes (requires authentication)
router.post('/', requireAuth, OrderController.createOrder);
router.delete('/:orderId', requireAuth, OrderController.cancelOrder);

// Admin-only routes
router.put('/:orderId/status', requireAuth, requireAdmin, OrderController.updateOrderStatus);

export default router;
