ALTER TABLE "Ticket"
    ADD COLUMN IF NOT EXISTS "categoryId" INTEGER,
    ADD COLUMN IF NOT EXISTS "resolution" TEXT,
    ADD COLUMN IF NOT EXISTS "messageCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "TicketPanel" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT,
    "messageId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Need a hand?',
    "description" TEXT NOT NULL DEFAULT 'Choose a category below and our team will be with you shortly.',
    "color" TEXT NOT NULL DEFAULT '#b9a7ff',
    "emoji" TEXT NOT NULL DEFAULT '☾',
    "imageUrl" TEXT,
    "footer" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TicketPanel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TicketPanel_guildId_key"
    ON "TicketPanel"("guildId");

CREATE TABLE IF NOT EXISTS "TicketCategory" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "panelId" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT 'A new support request.',
    "emoji" TEXT NOT NULL DEFAULT '✦',
    "discordCategoryId" TEXT,
    "staffRoleIds" JSONB NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#b9a7ff',
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 0,
    "maxOpen" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TicketCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TicketCategory_guildId_name_key"
    ON "TicketCategory"("guildId", "name");
CREATE INDEX IF NOT EXISTS "TicketCategory_guildId_enabled_idx"
    ON "TicketCategory"("guildId", "enabled");
CREATE INDEX IF NOT EXISTS "Ticket_guildId_categoryId_status_idx"
    ON "Ticket"("guildId", "categoryId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Ticket_categoryId_fkey'
  ) THEN
    ALTER TABLE "Ticket"
      ADD CONSTRAINT "Ticket_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "TicketCategory"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TicketPanel_guildId_fkey'
  ) THEN
    ALTER TABLE "TicketPanel"
      ADD CONSTRAINT "TicketPanel_guildId_fkey"
      FOREIGN KEY ("guildId") REFERENCES "Guild"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TicketCategory_guildId_fkey'
  ) THEN
    ALTER TABLE "TicketCategory"
      ADD CONSTRAINT "TicketCategory_guildId_fkey"
      FOREIGN KEY ("guildId") REFERENCES "Guild"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TicketCategory_panelId_fkey'
  ) THEN
    ALTER TABLE "TicketCategory"
      ADD CONSTRAINT "TicketCategory_panelId_fkey"
      FOREIGN KEY ("panelId") REFERENCES "TicketPanel"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
