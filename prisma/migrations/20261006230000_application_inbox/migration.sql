-- Extend the existing application tables without deleting or recreating data.
ALTER TABLE "ApplicationForm"
  ADD COLUMN "notificationChannelId" TEXT,
  ADD COLUMN "maxSubmissions" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "cooldownSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "minAccountAgeHours" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "requiredRoleId" TEXT,
  ADD COLUMN "minLevel" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "minMembershipHours" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "ApplicationQuestion"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "type" TEXT NOT NULL DEFAULT 'LONG_TEXT',
  ADD COLUMN "choices" JSONB,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "ApplicationSubmission"
  ADD COLUMN "username" TEXT,
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "avatar" TEXT,
  ADD COLUMN "reviewerUsername" TEXT,
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "dmStatus" TEXT NOT NULL DEFAULT 'NOT_SENT',
  ADD COLUMN "dmError" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Existing submissions already have a trustworthy createdAt timestamp. Preserve
-- it instead of assigning the migration time to their new submittedAt field.
UPDATE "ApplicationSubmission"
SET "submittedAt" = "createdAt"
WHERE "submittedAt" IS NULL;

ALTER TABLE "ApplicationSubmission"
  ALTER COLUMN "submittedAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "submittedAt" SET NOT NULL;

ALTER TABLE "ApplicationAnswer"
  ADD COLUMN "questionLabel" TEXT,
  ADD COLUMN "questionType" TEXT;

CREATE TABLE "ApplicationReviewEvent" (
  "id" SERIAL NOT NULL,
  "guildId" TEXT NOT NULL,
  "submissionId" INTEGER NOT NULL,
  "previousStatus" TEXT,
  "newStatus" TEXT NOT NULL,
  "reviewerId" TEXT,
  "reviewerUsername" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationReviewEvent_pkey" PRIMARY KEY ("id")
);

-- Backfill an initial history entry for every existing submission. This keeps
-- the old review state visible after the migration.
INSERT INTO "ApplicationReviewEvent"
  ("guildId", "submissionId", "previousStatus", "newStatus", "reviewerId", "createdAt")
SELECT
  "guildId",
  "id",
  NULL,
  "status",
  "reviewerId",
  "createdAt"
FROM "ApplicationSubmission";

CREATE INDEX "ApplicationForm_guildId_enabled_deletedAt_idx"
  ON "ApplicationForm"("guildId", "enabled", "deletedAt");
CREATE INDEX "ApplicationQuestion_formId_position_deletedAt_idx"
  ON "ApplicationQuestion"("formId", "position", "deletedAt");
CREATE INDEX "ApplicationSubmission_guildId_formId_status_submittedAt_idx"
  ON "ApplicationSubmission"("guildId", "formId", "status", "submittedAt");
CREATE INDEX "ApplicationSubmission_guildId_userId_formId_submittedAt_idx"
  ON "ApplicationSubmission"("guildId", "userId", "formId", "submittedAt");
CREATE INDEX "ApplicationSubmission_guildId_deletedAt_idx"
  ON "ApplicationSubmission"("guildId", "deletedAt");
CREATE INDEX "ApplicationReviewEvent_guildId_submissionId_createdAt_idx"
  ON "ApplicationReviewEvent"("guildId", "submissionId", "createdAt");

ALTER TABLE "ApplicationReviewEvent"
  ADD CONSTRAINT "ApplicationReviewEvent_guildId_fkey"
  FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationReviewEvent"
  ADD CONSTRAINT "ApplicationReviewEvent_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "ApplicationSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApplicationReviewEvent" ENABLE ROW LEVEL SECURITY;
