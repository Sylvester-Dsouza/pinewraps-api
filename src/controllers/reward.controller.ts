import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { RewardHistoryType, RewardTier } from '@prisma/client';

// Validation schemas
const addPointsSchema = z.object({
  amount: z.number().positive(),  // Order amount in AED
  orderId: z.string().optional(),
  description: z.string()
});

const redeemPointsSchema = z.object({
  points: z.number().int().positive(),
  orderId: z.string().optional() // Add orderId to the redeemPointsSchema
});

// Helper functions
const TIER_THRESHOLDS = {
  BRONZE: 0,      // Starting tier
  SILVER: 500,    // 500 AED in points
  GOLD: 1000,     // 1000 AED in points
  PLATINUM: 3000  // 3000 AED in points
} as const;

const TIER_POINT_RATES = {
  BRONZE: 0.07,    // 7% points
  SILVER: 0.12,    // 12% points
  GOLD: 0.15,      // 15% points
  PLATINUM: 0.20   // 20% points
} as const;

const determineCustomerTier = (totalPoints: number): RewardTier => {
  if (totalPoints >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
  if (totalPoints >= TIER_THRESHOLDS.GOLD) return 'GOLD';
  if (totalPoints >= TIER_THRESHOLDS.SILVER) return 'SILVER';
  return 'BRONZE';
};

const calculatePointsForPurchase = (amount: number, tier: RewardTier): number => {
  const rate = TIER_POINT_RATES[tier];
  return Math.floor(amount * rate);  // This will give 7 points for 100 AED for BRONZE tier
};

// Calculate AED value for points redemption (3 points = 1 AED)
const calculateRedemptionValue = (points: number): number => {
  return Math.floor(points / 3);
};

export const RewardController = {
  // Get customer's rewards
  async getCustomerRewards(req: Request, res: Response) {
    try {
      const uid = req.user.uid;

      // First get the customer
      const customer = await prisma.customer.findUnique({
        where: { firebaseUid: uid }
      });

      if (!customer) {
        return res.json({
          success: true,
          data: {
            points: 0,
            tier: 'GREEN' as RewardTier,
            totalPoints: 0,
            history: []
          }
        });
      }

      // Then get their rewards
      const rewards = await prisma.customerReward.findUnique({
        where: { customerId: customer.id },
        include: {
          history: {
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      });

      if (!rewards) {
        return res.json({
          success: true,
          data: {
            points: 0,
            tier: 'GREEN' as RewardTier,
            totalPoints: 0,
            history: []
          }
        });
      }

      return res.json({
        success: true,
        data: rewards
      });
    } catch (error) {
      console.error('Error getting customer rewards:', error);
      return res.status(500).json({ error: 'Failed to get rewards' });
    }
  },

  // Add points to customer
  async addPoints(req: Request, res: Response) {
    try {
      const uid = req.user.uid;
      const validation = addPointsSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid request data' });
      }

      // First get the customer
      const customer = await prisma.customer.findUnique({
        where: { firebaseUid: uid }
      });

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const { amount, orderId, description } = validation.data;

      const currentRewards = await prisma.customerReward.findUnique({
        where: { customerId: customer.id }
      });

      const currentTier = currentRewards?.tier || 'BRONZE';
      const earnedPoints = calculatePointsForPurchase(amount, currentTier);
      
      // Calculate new total points and determine tier
      const newTotalPoints = (currentRewards?.totalPoints || 0) + earnedPoints;
      const newTier = determineCustomerTier(newTotalPoints);

      const result = await prisma.customerReward.upsert({
        where: { customerId: customer.id },
        create: {
          customerId: customer.id,
          points: earnedPoints,
          totalPoints: earnedPoints,
          tier: newTier,
          history: {
            create: {
              customerId: customer.id,
              orderId: orderId || undefined,
              pointsEarned: earnedPoints,
              pointsRedeemed: 0,
              orderTotal: amount,
              action: RewardHistoryType.EARNED,
              description: `${earnedPoints} points earned for ${amount} AED purchase${orderId ? ` (Order: ${orderId})` : ''}`
            }
          }
        },
        update: {
          points: { increment: earnedPoints },
          totalPoints: { increment: earnedPoints },
          tier: newTier,
          history: {
            create: {
              customerId: customer.id,
              orderId: orderId || undefined,
              pointsEarned: earnedPoints,
              pointsRedeemed: 0,
              orderTotal: amount,
              action: RewardHistoryType.EARNED,
              description: `${earnedPoints} points earned for ${amount} AED purchase${orderId ? ` (Order: ${orderId})` : ''}`
            }
          }
        },
        include: {
          history: true
        }
      });

      // If tier upgraded, add a history entry for the upgrade
      if (newTier !== currentTier) {
        await prisma.rewardHistory.create({
          data: {
            customerId: customer.id,
            orderId: orderId || undefined,
            rewardId: result.id,
            pointsEarned: 0,
            pointsRedeemed: 0,
            orderTotal: 0,
            action: RewardHistoryType.EARNED,
            description: `Congratulations! You've been upgraded to ${newTier} tier! You now earn ${TIER_POINT_RATES[newTier] * 100}% points on every order!`
          }
        });
      }

      return res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error adding points:', error);
      return res.status(500).json({ error: 'Failed to add points' });
    }
  },

  // Redeem points (3 points = 1 AED)
  async redeemPoints(req: Request, res: Response) {
    try {
      const uid = req.user.uid;
      const validation = redeemPointsSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid request data' });
      }

      // First get the customer
      const customer = await prisma.customer.findUnique({
        where: { firebaseUid: uid }
      });

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const { points, orderId } = validation.data;

      const currentRewards = await prisma.customerReward.findUnique({
        where: { customerId: customer.id }
      });

      if (!currentRewards) {
        return res.status(404).json({ error: 'Reward record not found' });
      }

      if (currentRewards.points < points) {
        return res.status(400).json({ error: 'Insufficient points' });
      }

      // Calculate redemption value (3 points = 1 AED)
      const redemptionValue = calculateRedemptionValue(points);

      // Update points
      const updatedReward = await prisma.customerReward.update({
        where: { customerId: customer.id },
        data: {
          points: { decrement: points },
          history: {
            create: {
              customerId: customer.id,
              pointsEarned: 0,
              pointsRedeemed: points,
              orderTotal: 0,
              action: RewardHistoryType.REDEEMED,
              description: `Redeemed ${points} points for AED ${redemptionValue}`,
              orderId: orderId // Add the required orderId field
            }
          }
        },
        include: {
          history: true
        }
      });

      return res.json({
        success: true,
        data: {
          points: updatedReward.points,
          redemptionValue
        }
      });
    } catch (error) {
      console.error('Error redeeming points:', error);
      return res.status(500).json({ error: 'Failed to redeem points' });
    }
  },

  // Get customer's rewards (admin only)
  async getCustomerRewardsAdmin(req: Request, res: Response) {
    try {
      const { customerId } = req.params;

      const customer = await prisma.customer.findUnique({
        where: { id: customerId }
      });

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const rewards = await prisma.customerReward.findUnique({
        where: { customerId },
        include: {
          history: {
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      });

      if (!rewards) {
        return res.json({
          success: true,
          data: {
            points: 0,
            tier: 'GREEN' as RewardTier,
            totalPoints: 0,
            history: []
          }
        });
      }

      return res.json({
        success: true,
        data: rewards
      });
    } catch (error) {
      console.error('Error getting customer rewards:', error);
      return res.status(500).json({ error: 'Failed to get rewards' });
    }
  },

  // Add points to customer (admin only)
  async addPointsToCustomer(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      const { points, description, orderTotal = 0 } = req.body;
      const orderId = req.body.orderId;

      // Validate input
      if (!points || points <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_POINTS',
            message: 'Points must be greater than 0'
          }
        });
      }

      // Check if customer exists
      const customer = await prisma.customer.findUnique({
        where: { id: customerId }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: 'Customer not found'
          }
        });
      }

      // Get or create customer rewards
      let rewards = await prisma.customerReward.findUnique({
        where: { customerId }
      });

      if (!rewards) {
        rewards = await prisma.customerReward.create({
          data: {
            customerId,
            points: 0,
            totalPoints: 0,
            tier: 'GREEN'
          }
        });
      }

      // Add points and update tier
      const newPoints = rewards.points + points;
      const newTotalPoints = (rewards.totalPoints || 0) + points;
      const newTier = determineCustomerTier(newTotalPoints);

      // Update rewards
      const updatedRewards = await prisma.customerReward.update({
        where: { customerId },
        data: {
          points: newPoints,
          totalPoints: newTotalPoints,
          tier: newTier,
          history: {
            create: {
              customerId: customer.id,
              orderId: orderId || undefined,
              pointsEarned: points,
              pointsRedeemed: 0,
              orderTotal,
              action: RewardHistoryType.EARNED,
              description: description || 'Points added by admin'
            }
          }
        },
        include: {
          history: {
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      });

      // If tier upgraded, add a history entry for the upgrade
      if (newTier !== rewards.tier) {
        await prisma.rewardHistory.create({
          data: {
            customerId: customer.id,
            orderId: orderId || undefined,
            rewardId: updatedRewards.id,
            pointsEarned: 0,
            pointsRedeemed: 0,
            orderTotal: 0,
            action: RewardHistoryType.EARNED,
            description: `Congratulations! You've been upgraded to ${newTier} tier! You now earn ${TIER_POINT_RATES[newTier] * 100}% points on every order!`
          }
        });
      }

      return res.json({
        success: true,
        data: updatedRewards
      });
    } catch (error) {
      console.error('Error adding points to customer:', error);
      return res.status(500).json({ error: 'Failed to add points to customer' });
    }
  },

  // Get customer's reward history (admin only)
  async getCustomerRewardHistory(req: Request, res: Response) {
    try {
      const { customerId } = req.params;

      const customer = await prisma.customer.findUnique({
        where: { id: customerId }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: 'Customer not found'
          }
        });
      }

      const history = await prisma.rewardHistory.findMany({
        where: { customerId },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return res.json({
        success: true,
        data: {
          history
        }
      });
    } catch (error) {
      console.error('Error getting reward history:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch reward history'
        }
      });
    }
  },

  // Get rewards analytics
  async getRewardsAnalytics(req: Request, res: Response) {
    try {
      const totalCustomers = await prisma.customerReward.count();
      
      const tierCounts = await prisma.customerReward.groupBy({
        by: ['tier'],
        _count: {
          _all: true
        }
      });

      const totalPoints = await prisma.customerReward.aggregate({
        _sum: {
          points: true,
          totalPoints: true
        }
      });

      const recentHistory = await prisma.rewardHistory.findMany({
        take: 10,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          customer: true
        }
      });

      return res.json({
        success: true,
        data: {
          totalCustomers,
          tierDistribution: tierCounts.map(tier => ({
            tier: tier.tier,
            count: tier._count._all
          })),
          points: {
            current: totalPoints._sum.points || 0,
            allTime: totalPoints._sum.totalPoints || 0
          },
          recentActivity: recentHistory
        }
      });
    } catch (error) {
      console.error('Error getting rewards analytics:', error);
      return res.status(500).json({ error: 'Failed to get rewards analytics' });
    }
  }
};
