import { RewardTier } from '../models/order.model';

// Reward tiers and their point rates (as percentages)
export const REWARD_TIERS = {
  [RewardTier.GREEN]: {
    name: RewardTier.GREEN,
    minPoints: 0,
    pointRate: 0.07, // 7% points
  },
  [RewardTier.SILVER]: {
    name: RewardTier.SILVER,
    minPoints: 500,
    pointRate: 0.12, // 12% points
  },
  [RewardTier.GOLD]: {
    name: RewardTier.GOLD,
    minPoints: 1000,
    pointRate: 0.15, // 15% points
  },
  [RewardTier.PLATINUM]: {
    name: RewardTier.PLATINUM,
    minPoints: 3000,
    pointRate: 0.20, // 20% points
  },
};

export function calculateRewardPoints(orderTotal: number, totalPoints: number): number {
  // Determine customer's tier based on total points
  let tier = REWARD_TIERS[RewardTier.GREEN];
  
  if (totalPoints >= REWARD_TIERS[RewardTier.PLATINUM].minPoints) {
    tier = REWARD_TIERS[RewardTier.PLATINUM];
  } else if (totalPoints >= REWARD_TIERS[RewardTier.GOLD].minPoints) {
    tier = REWARD_TIERS[RewardTier.GOLD];
  } else if (totalPoints >= REWARD_TIERS[RewardTier.SILVER].minPoints) {
    tier = REWARD_TIERS[RewardTier.SILVER];
  }

  // Calculate points based on tier's point rate (percentage)
  return Math.floor(orderTotal * tier.pointRate);
}

export function getCustomerTier(totalPoints: number): RewardTier {
  if (totalPoints >= REWARD_TIERS[RewardTier.PLATINUM].minPoints) {
    return RewardTier.PLATINUM;
  } else if (totalPoints >= REWARD_TIERS[RewardTier.GOLD].minPoints) {
    return RewardTier.GOLD;
  } else if (totalPoints >= REWARD_TIERS[RewardTier.SILVER].minPoints) {
    return RewardTier.SILVER;
  }
  return RewardTier.GREEN;
}

export function getNextTier(totalPoints: number): { 
  name: RewardTier; 
  remainingPoints: number 
} | null {
  const currentTier = getCustomerTier(totalPoints);
  
  switch (currentTier) {
    case RewardTier.GREEN:
      return {
        name: RewardTier.SILVER,
        remainingPoints: REWARD_TIERS[RewardTier.SILVER].minPoints - totalPoints
      };
    case RewardTier.SILVER:
      return {
        name: RewardTier.GOLD,
        remainingPoints: REWARD_TIERS[RewardTier.GOLD].minPoints - totalPoints
      };
    case RewardTier.GOLD:
      return {
        name: RewardTier.PLATINUM,
        remainingPoints: REWARD_TIERS[RewardTier.PLATINUM].minPoints - totalPoints
      };
    default:
      return null;
  }
}
