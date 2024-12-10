import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

// Validation schemas
const addPointsSchema = z.object({
  amount: z.number().positive(),  // Order amount in AED
  orderId: z.string().optional(),
  description: z.string()
});

const redeemPointsSchema = z.object({
  points: z.number().int().positive()
});

// Helper functions
const TIER_THRESHOLDS = {
  BRONZE: 0,      // Starting tier
  SILVER: 500,    // 500 AED in points
  GOLD: 1000,     // 1000 AED in points
  PLATINUM: 3000  // 3000 AED in points
};

const TIER_POINT_RATES = {
  BRONZE: 0.07,    // 7% points
  SILVER: 0.12,    // 12% points
  GOLD: 0.15,      // 15% points
  PLATINUM: 0.20   // 20% points
};

const determineUserTier = (totalPoints: number) => {
  if (totalPoints >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
  if (totalPoints >= TIER_THRESHOLDS.GOLD) return 'GOLD';
  if (totalPoints >= TIER_THRESHOLDS.SILVER) return 'SILVER';
  return 'BRONZE';
};

const calculatePointsForPurchase = (amount: number, tier: string) => {
  const rate = TIER_POINT_RATES[tier];
  return Math.floor(amount * rate);  // This will give 7 points for 100 AED for BRONZE tier
};

// Calculate AED value for points redemption (3 points = 1 AED)
const calculateRedemptionValue = (points: number) => {
  return Math.floor(points / 3);
};

export const RewardController = {
  // Get user's rewards
  async getUserRewards(req: Request, res: Response) {
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
            tier: 'BRONZE',
            totalPoints: 0,
            history: []
          }
        });
      }

      // Then get their rewards
      const rewards = await prisma.userReward.findUnique({
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
            tier: 'BRONZE',
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
      console.error('Error getting user rewards:', error);
      return res.status(500).json({ error: 'Failed to get rewards' });
    }
  },

  // Add points to user
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

      const currentRewards = await prisma.userReward.findUnique({
        where: { customerId: customer.id }
      });

      const currentTier = currentRewards?.tier || 'BRONZE';
      const earnedPoints = calculatePointsForPurchase(amount, currentTier);
      
      // Calculate new total points and determine tier
      const newTotalPoints = (currentRewards?.totalPoints || 0) + earnedPoints;
      const newTier = determineUserTier(newTotalPoints);

      const result = await prisma.userReward.upsert({
        where: { customerId: customer.id },
        create: {
          customerId: customer.id,
          points: earnedPoints,
          totalPoints: earnedPoints,
          tier: newTier,
          totalSpent: amount,
          history: {
            create: {
              customerId: customer.id,
              orderId,
              pointsEarned: earnedPoints,
              pointsRedeemed: 0,
              orderTotal: amount,
              action: 'EARNED',
              description: `${earnedPoints} points earned for ${amount} AED purchase${orderId ? ` (Order: ${orderId})` : ''}`
            }
          }
        },
        update: {
          points: { increment: earnedPoints },
          totalPoints: { increment: earnedPoints },
          tier: newTier,
          totalSpent: { increment: amount },
          history: {
            create: {
              customerId: customer.id,
              orderId,
              pointsEarned: earnedPoints,
              pointsRedeemed: 0,
              orderTotal: amount,
              action: 'EARNED',
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
            orderId,
            rewardId: result.id,
            pointsEarned: 0,
            pointsRedeemed: 0,
            orderTotal: 0,
            action: 'EARNED',
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

      const { points } = validation.data;

      const currentRewards = await prisma.userReward.findUnique({
        where: { customerId: customer.id }
      });

      if (!currentRewards) {
        return res.status(404).json({ error: 'Reward record not found' });
      }

      if (currentRewards.points < points) {
        return res.status(400).json({ error: 'Insufficient points' });
      }

      // Calculate redemption value (3 points = 1 AED)
      const redeemValue = calculateRedemptionValue(points);

      // Update points
      const updatedReward = await prisma.userReward.update({
        where: { customerId: customer.id },
        data: {
          points: { decrement: points },
          history: {
            create: {
              customerId: customer.id,
              pointsEarned: 0,
              pointsRedeemed: points,
              orderTotal: 0,
              action: 'REDEEMED',
              description: `Redeemed ${points} points for AED ${redeemValue}`
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
          redeemValue
        }
      });
    } catch (error) {
      console.error('Error redeeming points:', error);
      return res.status(500).json({ error: 'Failed to redeem points' });
    }
  },

  // Get customer's rewards (admin only)
  async getCustomerRewards(req: Request, res: Response) {
    try {
      const { customerId } = req.params;

      const customer = await prisma.customer.findUnique({
        where: { id: customerId }
      });

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const rewards = await prisma.userReward.findUnique({
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
            tier: 'BRONZE',
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
      const { points, description } = req.body;
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

      // Get or create user rewards
      let rewards = await prisma.userReward.findUnique({
        where: { customerId }
      });

      if (!rewards) {
        rewards = await prisma.userReward.create({
          data: {
            customerId,
            points: 0,
            totalPoints: 0,
            tier: 'BRONZE'
          }
        });
      }

      // Add points and update tier
      const newPoints = rewards.points + points;
      const newTotalPoints = (rewards.totalPoints || 0) + points;
      const newTier = determineUserTier(newTotalPoints);

      // Update rewards
      const updatedRewards = await prisma.userReward.update({
        where: { customerId },
        data: {
          points: newPoints,
          totalPoints: newTotalPoints,
          tier: newTier,
          history: {
            create: {
              customerId: customer.id,
              orderId,
              pointsEarned: points,
              pointsRedeemed: 0,
              orderTotal: 0,
              action: 'EARNED',
              description: description || 'Points added by admin',
              ...(orderId && { orderId })
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

      return res.json({
        success: true,
        data: updatedRewards
      });
    } catch (error) {
      console.error('Error adding points to customer:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to add points'
        }
      });
    }
  },

  // Get rewards analytics
  async getRewardsAnalytics(req: Request, res: Response) {
    try {
      // Get total users with rewards
      const totalUsersWithRewards = await prisma.userReward.count();

      // Get total points awarded
      const totalPointsAwarded = await prisma.userReward.aggregate({
        _sum: {
          totalPoints: true
        }
      });

      // Get total active points (not redeemed)
      const totalActivePoints = await prisma.userReward.aggregate({
        _sum: {
          points: true
        }
      });

      // Get user tiers distribution
      const allUserRewards = await prisma.userReward.findMany({
        select: {
          totalPoints: true
        }
      });

      const tierDistribution = {
        BRONZE: 0,
        SILVER: 0,
        GOLD: 0,
        PLATINUM: 0
      };

      allUserRewards.forEach(reward => {
        const tier = determineUserTier(reward.totalPoints);
        tierDistribution[tier]++;
      });

      // Calculate total AED value of redeemed points
      const redeemedPoints = (totalPointsAwarded._sum.totalPoints || 0) - (totalActivePoints._sum.points || 0);
      const redeemedValue = calculateRedemptionValue(redeemedPoints);

      return res.json({
        success: true,
        data: {
          totalUsersWithRewards,
          totalPointsAwarded: totalPointsAwarded._sum.totalPoints || 0,
          totalActivePoints: totalActivePoints._sum.points || 0,
          redeemedPoints,
          redeemedValue,
          tierDistribution,
          pointsToAEDRate: '3 points = 1 AED',
          tiers: {
            BRONZE: {
              threshold: TIER_THRESHOLDS.BRONZE,
              pointRate: TIER_POINT_RATES.BRONZE * 100 + '%'
            },
            SILVER: {
              threshold: TIER_THRESHOLDS.SILVER,
              pointRate: TIER_POINT_RATES.SILVER * 100 + '%'
            },
            GOLD: {
              threshold: TIER_THRESHOLDS.GOLD,
              pointRate: TIER_POINT_RATES.GOLD * 100 + '%'
            },
            PLATINUM: {
              threshold: TIER_THRESHOLDS.PLATINUM,
              pointRate: TIER_POINT_RATES.PLATINUM * 100 + '%'
            }
          }
        }
      });
    } catch (error) {
      console.error('Error fetching rewards analytics:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'REWARDS_ANALYTICS_ERROR',
          message: 'Failed to fetch rewards analytics',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }
};
