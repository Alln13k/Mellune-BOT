async function getProfile(prisma, guildId, userId) {
  const [user, level, tickets, entries, wins] = await Promise.all([
    prisma.user.findUnique({ where: { guildId_userId: { guildId, userId } } }),
    prisma.levelUser.findUnique({ where: { guildId_userId: { guildId, userId } } }),
    prisma.ticket.count({ where: { guildId, creatorId: userId } }),
    prisma.giveawayEntry.count({ where: { guildId, userId } }),
    prisma.giveawayWinner.count({ where: { userId, giveaway: { guildId } } }),
  ]);
  if (!user && !level) return null;
  const xp = level?.xp || 0;
  const ahead = await prisma.levelUser.count({
    where: { guildId, xp: { gt: xp } },
  });
  const levelNumber = level?.level || 0;
  const nextXp = (levelNumber + 1) ** 2 * 100;
  const previousXp = levelNumber ** 2 * 100;
  const progressXp = Math.max(0, xp - previousXp);
  const requiredXp = Math.max(1, nextXp - previousXp);
  return {
    user: user || { userId, username: userId, displayName: null, avatar: null },
    level: levelNumber,
    xp,
    nextXp,
    progress: Math.min(100, Math.round((progressXp / requiredXp) * 100)),
    messages: level?.messages || 0,
    rank: ahead + 1,
    tickets,
    giveawaysEntered: entries,
    giveawaysWon: wins,
  };
}

module.exports = { getProfile };
