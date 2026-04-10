CREATE TYPE "CompanionKind" AS ENUM ('CAT', 'DOG', 'COMPUTER', 'DOLPHIN', 'CUSTOM');

CREATE TABLE "UserCompanionProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "CompanionKind" NOT NULL DEFAULT 'CUSTOM',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '✨',
    "description" TEXT NOT NULL,
    "styleGuide" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCompanionProfile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Room"
ADD COLUMN     "botEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "botProfileId" TEXT;

ALTER TABLE "ChatMessage"
ADD COLUMN     "botEmoji" TEXT,
ADD COLUMN     "botName" TEXT;

CREATE UNIQUE INDEX "UserCompanionProfile_userId_slug_key" ON "UserCompanionProfile"("userId", "slug");
CREATE INDEX "UserCompanionProfile_userId_isDefault_idx" ON "UserCompanionProfile"("userId", "isDefault");
CREATE INDEX "Room_botProfileId_idx" ON "Room"("botProfileId");

ALTER TABLE "UserCompanionProfile" ADD CONSTRAINT "UserCompanionProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_botProfileId_fkey" FOREIGN KEY ("botProfileId") REFERENCES "UserCompanionProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
