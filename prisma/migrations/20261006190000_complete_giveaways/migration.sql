-- Complete, additive giveaway persistence.
ALTER TABLE "Giveaway"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "embedTitle" TEXT,
  ADD COLUMN "embedDescription" TEXT,
  ADD COLUMN "embedColor" TEXT NOT NULL DEFAULT '#3C527F',
  ADD COLUMN "thumbnailUrl" TEXT,
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "authorName" TEXT,
  ADD COLUMN "authorIconUrl" TEXT,
  ADD COLUMN "footerText" TEXT,
  ADD COLUMN "footerIconUrl" TEXT,
  ADD COLUMN "timestamp" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "buttonLabel" TEXT NOT NULL DEFAULT 'Enter Giveaway',
  ADD COLUMN "buttonEmoji" TEXT NOT NULL DEFAULT '🎉',
  ADD COLUMN "durationSeconds" INTEGER NOT NULL DEFAULT 86400,
  ADD COLUMN "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "bonusRoleIds" JSONB,
  ADD COLUMN "minAccountAgeHours" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "minMembershipHours" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "discordStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "discordError" TEXT,
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
  ADD COLUMN "endedAt" TIMESTAMP(3);

ALTER TABLE "Giveaway"
  ALTER COLUMN "status" SET DEFAULT 'QUEUED';

ALTER TABLE "GiveawayEntry"
  ADD COLUMN "guildId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "weight" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "GiveawayEntry" AS entry
SET "guildId" = giveaway."guildId"
FROM "Giveaway" AS giveaway
WHERE entry."giveawayId" = giveaway."id";

ALTER TABLE "GiveawayEntry"
  ALTER COLUMN "guildId" DROP DEFAULT;

CREATE TABLE "GiveawayWinner" (
  "id" SERIAL NOT NULL,
  "giveawayId" INTEGER NOT NULL,
  "userId" TEXT NOT NULL,
  "round" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiveawayWinner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Giveaway_guildId_createdAt_idx"
  ON "Giveaway"("guildId", "createdAt");
CREATE INDEX "GiveawayEntry_guildId_giveawayId_createdAt_idx"
  ON "GiveawayEntry"("guildId", "giveawayId", "createdAt");
CREATE INDEX "GiveawayWinner_giveawayId_round_idx"
  ON "GiveawayWinner"("giveawayId", "round");

ALTER TABLE "GiveawayWinner"
  ADD CONSTRAINT "GiveawayWinner_giveawayId_fkey"
  FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GiveawayWinner" ENABLE ROW LEVEL SECURITY;
