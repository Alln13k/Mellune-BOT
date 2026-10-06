ALTER TABLE "GuildSettings"
  ADD COLUMN "levelUpEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "levelUpChannelId" TEXT,
  ADD COLUMN "levelUpPayload" JSONB,
  ADD COLUMN "levelUpMention" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "User"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "avatar" TEXT,
  ADD COLUMN "joinedAt" TIMESTAMP(3);

CREATE TABLE "MemberCounterConfig" (
  "id" SERIAL NOT NULL,
  "guildId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "channelId" TEXT,
  "categoryId" TEXT,
  "format" TEXT NOT NULL DEFAULT '👥 Members: {membercount}',
  "lastCount" INTEGER,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemberCounterConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutoRoleConfig" (
  "id" SERIAL NOT NULL,
  "guildId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "roleIds" JSONB NOT NULL,
  "ignoreBots" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutoRoleConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServerBackup" (
  "id" SERIAL NOT NULL,
  "guildId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "createdBy" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "summary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServerBackup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberCounterConfig_guildId_key" ON "MemberCounterConfig"("guildId");
CREATE UNIQUE INDEX "AutoRoleConfig_guildId_key" ON "AutoRoleConfig"("guildId");
CREATE INDEX "ServerBackup_guildId_createdAt_idx" ON "ServerBackup"("guildId", "createdAt");

ALTER TABLE "MemberCounterConfig"
  ADD CONSTRAINT "MemberCounterConfig_guildId_fkey"
  FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutoRoleConfig"
  ADD CONSTRAINT "AutoRoleConfig_guildId_fkey"
  FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServerBackup"
  ADD CONSTRAINT "ServerBackup_guildId_fkey"
  FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemberCounterConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AutoRoleConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServerBackup" ENABLE ROW LEVEL SECURITY;
