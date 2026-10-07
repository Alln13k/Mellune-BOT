-- DropIndex
DROP INDEX "ReactionRole_messageId_key";

-- CreateIndex
CREATE INDEX "ReactionRole_guildId_messageId_idx" ON "ReactionRole"("guildId", "messageId");

