async function recordActivity(
  prisma,
  { guildId, kind, userId = null, channelId = null, metadata = null },
) {
  if (!guildId || !kind) return null;
  return prisma.activityEvent.create({
    data: { guildId, kind, userId, channelId, metadata },
  });
}

module.exports = { recordActivity };
