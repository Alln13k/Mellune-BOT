-- Dashboard OAuth sessions are server-side; the browser receives only an opaque id.
CREATE TABLE IF NOT EXISTS "DashboardSession" (
    "id" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "globalName" TEXT,
    "avatar" TEXT,
    "accessToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DashboardSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DashboardSession_expiresAt_idx"
    ON "DashboardSession"("expiresAt");

CREATE INDEX IF NOT EXISTS "DashboardSession_discordUserId_idx"
    ON "DashboardSession"("discordUserId");
