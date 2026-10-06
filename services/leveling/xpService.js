const XP_COOLDOWN_MS = 60_000;

async function addMessageXp(prisma, guildId, userId) {
  const current = await prisma.levelUser.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });
  if (
    current?.lastMessageAt &&
    Date.now() - current.lastMessageAt.getTime() < XP_COOLDOWN_MS
  )
    return { entry: current, previousLevel: current.level, leveledUp: false };
  const xp = (current?.xp || 0) + Math.floor(Math.random() * 11) + 10;
  const level = Math.floor(Math.sqrt(xp / 100));
  const entry = await prisma.levelUser.upsert({
    where: { guildId_userId: { guildId, userId } },
    update: {
      xp,
      level,
      messages: { increment: 1 },
      lastMessageAt: new Date(),
    },
    create: {
      guildId,
      userId,
      xp,
      level,
      messages: 1,
      lastMessageAt: new Date(),
    },
  });
  return {
    entry,
    previousLevel: current?.level || 0,
    leveledUp: entry.level > (current?.level || 0),
  };
}

module.exports = { addMessageXp };
