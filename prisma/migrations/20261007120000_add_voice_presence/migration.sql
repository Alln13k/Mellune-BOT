CREATE TABLE "VoicePresenceConfig" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VoicePresenceConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VoicePresenceConfig_guildId_key" ON "VoicePresenceConfig"("guildId");
ALTER TABLE "VoicePresenceConfig" ADD CONSTRAINT "VoicePresenceConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
