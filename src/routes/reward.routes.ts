import express from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { ApiError } from '../lib/error';
import { RewardController } from '../controllers/reward.controller';

const router = express.Router();

// Admin endpoints
router.get('/analytics', requireAuth, requireAdmin, RewardController.getRewardsAnalytics);
router.get('/:customerId', requireAuth, requireAdmin, RewardController.getCustomerRewards);
router.get('/:customerId/history', requireAuth, requireAdmin, RewardController.getCustomerRewardHistory);
router.post('/:customerId/add', requireAuth, requireAdmin, RewardController.addPointsToCustomer);

// Customer endpoints
router.get('/', requireAuth, RewardController.getCustomerRewards);
router.post('/redeem', requireAuth, RewardController.redeemPoints);

export default router;
