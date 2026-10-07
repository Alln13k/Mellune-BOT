-- Premium ticket panels and durable ticket metadata
ALTER TABLE "Ticket"
  ADD COLUMN IF NOT EXISTS "closedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "closeReason" TEXT,
  ADD COLUMN IF NOT EXISTS "panelId" INTEGER,
  ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "transcript" JSONB,
  ADD COLUMN IF NOT EXISTS "rating" INTEGER,
  ADD COLUMN IF NOT EXISTS "ratingFeedback" TEXT,
  ADD COLUMN IF NOT EXISTS "ratedAt" TIMESTAMP(3);

ALTER TABLE "TicketPanel"
  ADD COLUMN IF NOT EXISTS "panelKey" TEXT NOT NULL DEFAULT 'support',
  ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT 'Support',
  ADD COLUMN IF NOT EXISTS "payload" JSONB,
  ADD COLUMN IF NOT EXISTS "buttonLabel" TEXT NOT NULL DEFAULT 'Open ticket',
  ADD COLUMN IF NOT EXISTS "buttonStyle" TEXT NOT NULL DEFAULT 'SECONDARY',
  ADD COLUMN IF NOT EXISTS "buttonEmoji" TEXT,
  ADD COLUMN IF NOT EXISTS "mentionStaff" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mentionCreator" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "autoWelcome" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "autoAddStaff" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "maxOpen" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "cooldownSeconds" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "TicketPanel_guildId_key";
DROP INDEX IF EXISTS "TicketCategory_guildId_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "TicketPanel_guildId_panelKey_key"
  ON "TicketPanel"("guildId", "panelKey");
CREATE INDEX IF NOT EXISTS "TicketPanel_guildId_enabled_idx"
  ON "TicketPanel"("guildId", "enabled");
CREATE INDEX IF NOT EXISTS "TicketCategory_guildId_panelId_name_idx"
  ON "TicketCategory"("guildId", "panelId", "name");
CREATE INDEX IF NOT EXISTS "Ticket_guildId_panelId_status_idx"
  ON "Ticket"("guildId", "panelId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Ticket_panelId_fkey'
  ) THEN
    ALTER TABLE "Ticket"
      ADD CONSTRAINT "Ticket_panelId_fkey"
      FOREIGN KEY ("panelId") REFERENCES "TicketPanel"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

UPDATE "TicketPanel"
SET "color" = '#3C527F'
WHERE "color" = '#b9a7ff';
UPDATE "TicketCategory"
SET "color" = '#3C527F'
WHERE "color" = '#b9a7ff';
UPDATE "GreetingConfig"
SET "color" = '#3C527F'
WHERE "color" = '#b9a7ff';
ALTER TABLE "TicketPanel" ALTER COLUMN "color" SET DEFAULT '#3C527F';
ALTER TABLE "TicketCategory" ALTER COLUMN "color" SET DEFAULT '#3C527F';
ALTER TABLE "GreetingConfig" ALTER COLUMN "color" SET DEFAULT '#3C527F';

-- Multi-entry reaction role panels
ALTER TABLE "ReactionRole"
  ALTER COLUMN "messageId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "panelId" INTEGER,
  ADD COLUMN IF NOT EXISTS "emoji" TEXT NOT NULL DEFAULT '🔘',
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'BUTTON',
  ADD COLUMN IF NOT EXISTS "exclusiveGroup" TEXT,
  ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "ReactionRolePanel" (
  "id" SERIAL NOT NULL,
  "guildId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "messageId" TEXT,
  "mode" TEXT NOT NULL DEFAULT 'BUTTON',
  "title" TEXT,
  "description" TEXT,
  "color" TEXT NOT NULL DEFAULT '#3C527F',
  "authorName" TEXT,
  "authorIconUrl" TEXT,
  "thumbnailUrl" TEXT,
  "imageUrl" TEXT,
  "footer" TEXT,
  "footerIconUrl" TEXT,
  "useTimestamp" BOOLEAN NOT NULL DEFAULT false,
  "exclusiveMode" TEXT NOT NULL DEFAULT 'MULTIPLE',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReactionRolePanel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReactionRolePanel_messageId_key"
  ON "ReactionRolePanel"("messageId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReactionRolePanel_guildId_name_key"
  ON "ReactionRolePanel"("guildId", "name");
CREATE INDEX IF NOT EXISTS "ReactionRolePanel_guildId_enabled_idx"
  ON "ReactionRolePanel"("guildId", "enabled");
CREATE INDEX IF NOT EXISTS "ReactionRole_guildId_panelId_idx"
  ON "ReactionRole"("guildId", "panelId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReactionRolePanel_guildId_fkey'
  ) THEN
    ALTER TABLE "ReactionRolePanel"
      ADD CONSTRAINT "ReactionRolePanel_guildId_fkey"
      FOREIGN KEY ("guildId") REFERENCES "Guild"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReactionRole_panelId_fkey'
  ) THEN
    ALTER TABLE "ReactionRole"
      ADD CONSTRAINT "ReactionRole_panelId_fkey"
      FOREIGN KEY ("panelId") REFERENCES "ReactionRolePanel"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Durable temporary voice rooms and server policy
ALTER TABLE "TemporaryVoiceConfig"
  ADD COLUMN IF NOT EXISTS "defaultPrivacy" TEXT NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS "maxRooms" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "autoDelete" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "staffRoleIds" JSONB,
  ADD COLUMN IF NOT EXISTS "panelPayload" JSONB;

CREATE TABLE IF NOT EXISTS "TemporaryVoiceRoom" (
  "id" SERIAL NOT NULL,
  "guildId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "textChannelId" TEXT,
  "panelMessageId" TEXT,
  "ownerId" TEXT NOT NULL,
  "privacy" TEXT NOT NULL DEFAULT 'PUBLIC',
  "userLimit" INTEGER NOT NULL DEFAULT 0,
  "whitelist" JSONB,
  "blocked" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TemporaryVoiceRoom_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TemporaryVoiceRoom_channelId_key"
  ON "TemporaryVoiceRoom"("channelId");
CREATE INDEX IF NOT EXISTS "TemporaryVoiceRoom_guildId_ownerId_idx"
  ON "TemporaryVoiceRoom"("guildId", "ownerId");
CREATE INDEX IF NOT EXISTS "TemporaryVoiceRoom_guildId_privacy_idx"
  ON "TemporaryVoiceRoom"("guildId", "privacy");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TemporaryVoiceRoom_guildId_fkey'
  ) THEN
    ALTER TABLE "TemporaryVoiceRoom"
      ADD CONSTRAINT "TemporaryVoiceRoom_guildId_fkey"
      FOREIGN KEY ("guildId") REFERENCES "Guild"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TemporaryVoiceRoom_config_guildId_fkey'
  ) THEN
    ALTER TABLE "TemporaryVoiceRoom"
      ADD CONSTRAINT "TemporaryVoiceRoom_config_guildId_fkey"
      FOREIGN KEY ("guildId") REFERENCES "TemporaryVoiceConfig"("guildId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "ReactionRolePanel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TemporaryVoiceRoom" ENABLE ROW LEVEL SECURITY;
