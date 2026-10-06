-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildSettings" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "staffRoleId" TEXT,
    "ticketCategoryId" TEXT,
    "xpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationCase" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'No reason provided.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warning" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'No reason provided.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "claimedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Giveaway" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "prize" TEXT NOT NULL,
    "winners" INTEGER NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "requiredRoleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiveawayEntry" (
    "id" SERIAL NOT NULL,
    "giveawayId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "GiveawayEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoModRule" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "action" TEXT NOT NULL DEFAULT 'DELETE',
    "value" TEXT,

    CONSTRAINT "AutoModRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WelcomeConfig" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT,
    "welcomeText" TEXT,
    "leaveText" TEXT,
    "dmEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoRoleId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WelcomeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelUser" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),

    CONSTRAINT "LevelUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReactionRole" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "ReactionRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomCommand" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogConfig" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "memberLogId" TEXT,
    "messageLogId" TEXT,
    "moderationLogId" TEXT,

    CONSTRAINT "LogConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuildSettings_guildId_key" ON "GuildSettings"("guildId");

-- CreateIndex
CREATE INDEX "User_guildId_idx" ON "User"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "User_guildId_userId_key" ON "User"("guildId", "userId");

-- CreateIndex
CREATE INDEX "ModerationCase_guildId_createdAt_idx" ON "ModerationCase"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "Warning_guildId_userId_idx" ON "Warning"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_channelId_key" ON "Ticket"("channelId");

-- CreateIndex
CREATE INDEX "Ticket_guildId_creatorId_status_idx" ON "Ticket"("guildId", "creatorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Giveaway_messageId_key" ON "Giveaway"("messageId");

-- CreateIndex
CREATE INDEX "Giveaway_status_endsAt_idx" ON "Giveaway"("status", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayEntry_giveawayId_userId_key" ON "GiveawayEntry"("giveawayId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AutoModRule_guildId_type_key" ON "AutoModRule"("guildId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "WelcomeConfig_guildId_key" ON "WelcomeConfig"("guildId");

-- CreateIndex
CREATE INDEX "LevelUser_guildId_xp_idx" ON "LevelUser"("guildId", "xp");

-- CreateIndex
CREATE UNIQUE INDEX "LevelUser_guildId_userId_key" ON "LevelUser"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReactionRole_messageId_key" ON "ReactionRole"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomCommand_guildId_name_key" ON "CustomCommand"("guildId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "LogConfig_guildId_key" ON "LogConfig"("guildId");

-- AddForeignKey
ALTER TABLE "GuildSettings" ADD CONSTRAINT "GuildSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_guildId_targetId_fkey" FOREIGN KEY ("guildId", "targetId") REFERENCES "User"("guildId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_guildId_userId_fkey" FOREIGN KEY ("guildId", "userId") REFERENCES "User"("guildId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Giveaway" ADD CONSTRAINT "Giveaway_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiveawayEntry" ADD CONSTRAINT "GiveawayEntry_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoModRule" ADD CONSTRAINT "AutoModRule_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WelcomeConfig" ADD CONSTRAINT "WelcomeConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelUser" ADD CONSTRAINT "LevelUser_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReactionRole" ADD CONSTRAINT "ReactionRole_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomCommand" ADD CONSTRAINT "CustomCommand_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogConfig" ADD CONSTRAINT "LogConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

