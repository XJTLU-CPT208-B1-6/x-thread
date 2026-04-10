CREATE TABLE "RoomCompanionSelection" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "companionProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomCompanionSelection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomCompanionSelection_roomId_companionProfileId_key" ON "RoomCompanionSelection"("roomId", "companionProfileId");
CREATE INDEX "RoomCompanionSelection_roomId_createdAt_idx" ON "RoomCompanionSelection"("roomId", "createdAt");
CREATE INDEX "RoomCompanionSelection_companionProfileId_idx" ON "RoomCompanionSelection"("companionProfileId");

ALTER TABLE "RoomCompanionSelection" ADD CONSTRAINT "RoomCompanionSelection_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomCompanionSelection" ADD CONSTRAINT "RoomCompanionSelection_companionProfileId_fkey" FOREIGN KEY ("companionProfileId") REFERENCES "UserCompanionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
