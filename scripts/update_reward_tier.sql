-- Temporarily change the column type to text
ALTER TABLE "CustomerReward" ALTER COLUMN "tier" TYPE text;

-- Update the values
UPDATE "CustomerReward" SET "tier" = 'GREEN' WHERE "tier" = 'BRONZE';

-- Drop the existing enum type
DROP TYPE IF EXISTS "RewardTier";

-- Create the new enum type
CREATE TYPE "RewardTier" AS ENUM ('GREEN', 'SILVER', 'GOLD', 'PLATINUM');

-- Convert the column back to the enum type
ALTER TABLE "CustomerReward" ALTER COLUMN "tier" TYPE "RewardTier" USING "tier"::"RewardTier";
