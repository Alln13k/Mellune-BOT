-- AlterTable
ALTER TABLE "GuildSettings" ADD COLUMN     "suggestionChannelId" TEXT,
ADD COLUMN     "suggestionEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suggestionStaffRoleId" TEXT;

-- AlterTable
ALTER TABLE "Giveaway" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "entryRequirements" JSONB,
ADD COLUMN     "startedBy" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "winnerIds" JSONB,
ALTER COLUMN "messageId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AutoModRule" ADD COLUMN     "logEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "patterns" JSONB,
ADD COLUMN     "threshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "windowSeconds" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "LogConfig" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "events" JSONB;

-- CreateTable
CREATE TABLE "GreetingConfig" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#b9a7ff',
    "footer" TEXT,
    "thumbnailUrl" TEXT,
    "imageUrl" TEXT,
    "useTimestamp" BOOLEAN NOT NULL DEFAULT false,
    "authorName" TEXT,
    "authorIconUrl" TEXT,
    "mentionMode" TEXT NOT NULL DEFAULT 'USER',
    "dmEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GreetingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidProtectionConfig" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "joinThreshold" INTEGER NOT NULL DEFAULT 5,
    "windowSeconds" INTEGER NOT NULL DEFAULT 10,
    "minAccountAgeHours" INTEGER NOT NULL DEFAULT 24,
    "suspiciousOnly" BOOLEAN NOT NULL DEFAULT true,
    "action" TEXT NOT NULL DEFAULT 'ALERT',
    "logChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaidProtectionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationConfig" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" TEXT,
    "roleId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Verify your membership',
    "description" TEXT NOT NULL DEFAULT 'Click the button below to access the server.',
    "buttonLabel" TEXT NOT NULL DEFAULT 'Verify',
    "minAccountAgeHours" INTEGER NOT NULL DEFAULT 0,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemporaryVoiceConfig" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "triggerChannelId" TEXT,
    "categoryId" TEXT,
    "nameFormat" TEXT NOT NULL DEFAULT '{username}''s room',
    "userLimit" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemporaryVoiceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationForm" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "destinationChannelId" TEXT,
    "reviewRoleId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationQuestion" (
    "id" SERIAL NOT NULL,
    "formId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ApplicationQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationSubmission" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "formId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "notes" TEXT,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationAnswer" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "answer" TEXT NOT NULL,

    CONSTRAINT "ApplicationAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT,
    "message" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "recurrence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastDeliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmbedDefinition" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmbedDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "content" TEXT,
    "payload" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "allowEveryone" BOOLEAN NOT NULL DEFAULT false,
    "allowHere" BOOLEAN NOT NULL DEFAULT false,
    "roleId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteractionDefinition" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InteractionDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT,
    "messageId" TEXT,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotJob" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" BIGSERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "userId" TEXT,
    "channelId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GreetingConfig_guildId_enabled_idx" ON "GreetingConfig"("guildId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "GreetingConfig_guildId_kind_key" ON "GreetingConfig"("guildId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "RaidProtectionConfig_guildId_key" ON "RaidProtectionConfig"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationConfig_guildId_key" ON "VerificationConfig"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "TemporaryVoiceConfig_guildId_key" ON "TemporaryVoiceConfig"("guildId");

-- CreateIndex
CREATE INDEX "ApplicationForm_guildId_enabled_idx" ON "ApplicationForm"("guildId", "enabled");

-- CreateIndex
CREATE INDEX "ApplicationQuestion_formId_position_idx" ON "ApplicationQuestion"("formId", "position");

-- CreateIndex
CREATE INDEX "ApplicationSubmission_guildId_status_createdAt_idx" ON "ApplicationSubmission"("guildId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationAnswer_submissionId_questionId_key" ON "ApplicationAnswer"("submissionId", "questionId");

-- CreateIndex
CREATE INDEX "Reminder_status_dueAt_idx" ON "Reminder"("status", "dueAt");

-- CreateIndex
CREATE INDEX "Reminder_guildId_userId_status_idx" ON "Reminder"("guildId", "userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmbedDefinition_guildId_name_key" ON "EmbedDefinition"("guildId", "name");

-- CreateIndex
CREATE INDEX "Announcement_guildId_status_scheduledAt_idx" ON "Announcement"("guildId", "status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "InteractionDefinition_guildId_name_key" ON "InteractionDefinition"("guildId", "name");

-- CreateIndex
CREATE INDEX "Suggestion_guildId_status_createdAt_idx" ON "Suggestion"("guildId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BotJob_status_runAt_idx" ON "BotJob"("status", "runAt");

-- CreateIndex
CREATE INDEX "BotJob_guildId_status_idx" ON "BotJob"("guildId", "status");

-- CreateIndex
CREATE INDEX "ActivityEvent_guildId_kind_createdAt_idx" ON "ActivityEvent"("guildId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_guildId_createdAt_idx" ON "ActivityEvent"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "Giveaway_guildId_status_idx" ON "Giveaway"("guildId", "status");

-- AddForeignKey
ALTER TABLE "GreetingConfig" ADD CONSTRAINT "GreetingConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidProtectionConfig" ADD CONSTRAINT "RaidProtectionConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationConfig" ADD CONSTRAINT "VerificationConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemporaryVoiceConfig" ADD CONSTRAINT "TemporaryVoiceConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationForm" ADD CONSTRAINT "ApplicationForm_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationQuestion" ADD CONSTRAINT "ApplicationQuestion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ApplicationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSubmission" ADD CONSTRAINT "ApplicationSubmission_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSubmission" ADD CONSTRAINT "ApplicationSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ApplicationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ApplicationSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ApplicationQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbedDefinition" ADD CONSTRAINT "EmbedDefinition_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionDefinition" ADD CONSTRAINT "InteractionDefinition_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotJob" ADD CONSTRAINT "BotJob_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GreetingConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RaidProtectionConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TemporaryVoiceConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationForm" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationAnswer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reminder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmbedDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Announcement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InteractionDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Suggestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BotJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityEvent" ENABLE ROW LEVEL SECURITY;

