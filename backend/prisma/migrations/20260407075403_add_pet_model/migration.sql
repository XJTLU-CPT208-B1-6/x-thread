/*
  Warnings:

  - The `mood` column on the `Pet` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "petType" TEXT NOT NULL DEFAULT 'cat',
ALTER COLUMN "name" SET DEFAULT 'Pet',
DROP COLUMN "mood",
ADD COLUMN     "mood" INTEGER NOT NULL DEFAULT 50;

-- DropEnum
DROP TYPE "PetMood";

-- CreateIndex
CREATE INDEX "Pet_roomId_idx" ON "Pet"("roomId");
