CREATE TABLE IF NOT EXISTS "CommunityEventSeries" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "recurrence" TEXT NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "weekdays" JSONB NOT NULL DEFAULT '[]',
    "anchorStart" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 120,
    "location" TEXT,
    "channelId" TEXT,
    "imageUrl" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3C527F',
    "organizerId" TEXT NOT NULL,
    "maxAttendees" INTEGER,
    "rsvpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "threadEnabled" BOOLEAN NOT NULL DEFAULT false,
    "roleIds" JSONB NOT NULL DEFAULT '[]',
    "roleMode" TEXT NOT NULL DEFAULT 'ANY',
    "reminderConfig" JSONB NOT NULL DEFAULT '[]',
    "embed" JSONB,
    "notifyConfig" JSONB,
    "kind" TEXT NOT NULL DEFAULT 'General',
    "publishLeadMinutes" INTEGER NOT NULL DEFAULT 10080,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunityEventSeries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommunityEventTemplate" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunityEventTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommunityEvent" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "seriesId" INTEGER,
    "templateId" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "location" TEXT,
    "channelId" TEXT,
    "imageUrl" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3C527F',
    "organizerId" TEXT NOT NULL,
    "maxAttendees" INTEGER,
    "rsvpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "threadEnabled" BOOLEAN NOT NULL DEFAULT false,
    "threadId" TEXT,
    "messageId" TEXT,
    "messageHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "seriesDetached" BOOLEAN NOT NULL DEFAULT false,
    "archiveThread" BOOLEAN NOT NULL DEFAULT true,
    "reminderConfig" JSONB NOT NULL DEFAULT '[]',
    "roleIds" JSONB NOT NULL DEFAULT '[]',
    "roleMode" TEXT NOT NULL DEFAULT 'ANY',
    "embed" JSONB,
    "notifyConfig" JSONB,
    "kind" TEXT NOT NULL DEFAULT 'General',
    "capacityNotifiedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunityEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommunityEventRsvp" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "avatar" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunityEventRsvp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommunityEventWaitlistEntry" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "avatar" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityEventWaitlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommunityEventReminder" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "guildId" TEXT NOT NULL,
    "offsetMinutes" INTEGER NOT NULL,
    "targets" JSONB NOT NULL DEFAULT '["DM"]',
    "includeTentative" BOOLEAN NOT NULL DEFAULT false,
    "runAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunityEventReminder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommunityEventLog" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "guildId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityEventLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommunityEventTemplate_guildId_name_key" ON "CommunityEventTemplate"("guildId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "CommunityEventRsvp_eventId_userId_key" ON "CommunityEventRsvp"("eventId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "CommunityEventWaitlistEntry_eventId_userId_key" ON "CommunityEventWaitlistEntry"("eventId", "userId");
CREATE INDEX IF NOT EXISTS "CommunityEventSeries_guildId_enabled_idx" ON "CommunityEventSeries"("guildId", "enabled");
CREATE INDEX IF NOT EXISTS "CommunityEventTemplate_guildId_idx" ON "CommunityEventTemplate"("guildId");
CREATE INDEX IF NOT EXISTS "CommunityEvent_guildId_status_startAt_idx" ON "CommunityEvent"("guildId", "status", "startAt");
CREATE INDEX IF NOT EXISTS "CommunityEvent_guildId_startAt_idx" ON "CommunityEvent"("guildId", "startAt");
CREATE INDEX IF NOT EXISTS "CommunityEvent_seriesId_startAt_idx" ON "CommunityEvent"("seriesId", "startAt");
CREATE INDEX IF NOT EXISTS "CommunityEvent_publishAt_publishedAt_idx" ON "CommunityEvent"("publishAt", "publishedAt");
CREATE INDEX IF NOT EXISTS "CommunityEventRsvp_guildId_userId_idx" ON "CommunityEventRsvp"("guildId", "userId");
CREATE INDEX IF NOT EXISTS "CommunityEventRsvp_eventId_status_idx" ON "CommunityEventRsvp"("eventId", "status");
CREATE INDEX IF NOT EXISTS "CommunityEventWaitlistEntry_eventId_position_idx" ON "CommunityEventWaitlistEntry"("eventId", "position");
CREATE INDEX IF NOT EXISTS "CommunityEventWaitlistEntry_guildId_userId_idx" ON "CommunityEventWaitlistEntry"("guildId", "userId");
CREATE INDEX IF NOT EXISTS "CommunityEventReminder_status_runAt_idx" ON "CommunityEventReminder"("status", "runAt");
CREATE INDEX IF NOT EXISTS "CommunityEventReminder_eventId_status_idx" ON "CommunityEventReminder"("eventId", "status");
CREATE INDEX IF NOT EXISTS "CommunityEventReminder_guildId_idx" ON "CommunityEventReminder"("guildId");
CREATE INDEX IF NOT EXISTS "CommunityEventLog_eventId_createdAt_idx" ON "CommunityEventLog"("eventId", "createdAt");
CREATE INDEX IF NOT EXISTS "CommunityEventLog_guildId_createdAt_idx" ON "CommunityEventLog"("guildId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "CommunityEventSeries" ADD CONSTRAINT "CommunityEventSeries_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CommunityEventTemplate" ADD CONSTRAINT "CommunityEventTemplate_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CommunityEvent" ADD CONSTRAINT "CommunityEvent_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CommunityEvent" ADD CONSTRAINT "CommunityEvent_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "CommunityEventSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CommunityEventRsvp" ADD CONSTRAINT "CommunityEventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CommunityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CommunityEventWaitlistEntry" ADD CONSTRAINT "CommunityEventWaitlistEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CommunityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CommunityEventReminder" ADD CONSTRAINT "CommunityEventReminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CommunityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CommunityEventLog" ADD CONSTRAINT "CommunityEventLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CommunityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
