-- First, update all existing records from BRONZE to GREEN
UPDATE "Customer" SET "rewardTier" = 'GREEN' WHERE "rewardTier" = 'BRONZE';

-- Then update the enum
ALTER TYPE "RewardTier" RENAME TO "RewardTier_old";
CREATE TYPE "RewardTier" AS ENUM ('GREEN', 'SILVER', 'GOLD');
ALTER TABLE "Customer" ALTER COLUMN "rewardTier" TYPE "RewardTier" USING ("rewardTier"::text::"RewardTier");
DROP TYPE "RewardTier_old";
