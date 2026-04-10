-- CreateEnum
CREATE TYPE "PersonalityType" AS ENUM ('I', 'E');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "personalityType" "PersonalityType";
