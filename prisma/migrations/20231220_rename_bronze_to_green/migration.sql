-- First, create a new enum type with the desired values
CREATE TYPE "RewardTier_new" AS ENUM ('GREEN', 'SILVER', 'GOLD', 'PLATINUM');

-- Update existing records to use the new value
UPDATE "CustomerReward" SET "tier" = 'GREEN'::"RewardTier" WHERE "tier" = 'BRONZE'::"RewardTier";

-- Drop the old enum type and rename the new one
ALTER TABLE "CustomerReward" ALTER COLUMN "tier" TYPE "RewardTier_new" USING ("tier"::text::"RewardTier_new");
DROP TYPE "RewardTier";
ALTER TYPE "RewardTier_new" RENAME TO "RewardTier";
