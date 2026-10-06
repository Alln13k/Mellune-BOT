const XP_COOLDOWN_MS = 60_000;

async function addMessageXp(prisma, guildId, userId) {
  const current = await prisma.levelUser.findUnique({ where: { guildId_userId: { guildId, userId } } });
  if (current?.lastMessageAt && Date.now() - current.lastMessageAt.getTime() < XP_COOLDOWN_MS) return current;
  const xp = (current?.xp || 0) + Math.floor(Math.random() * 11) + 10;
  const level = Math.floor(Math.sqrt(xp / 100));
  return prisma.levelUser.upsert({
    where: { guildId_userId: { guildId, userId } },
    update: { xp, level, messages: { increment: 1 }, lastMessageAt: new Date() },
    create: { guildId, userId, xp, level, messages: 1, lastMessageAt: new Date() },
  });
}

module.exports = { addMessageXp };
