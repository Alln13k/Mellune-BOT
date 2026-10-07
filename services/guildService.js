async function ensureGuild(prisma, guild) {
  return prisma.guild.upsert({
    where: { id: guild.id },
    update: { name: guild.name },
    create: { id: guild.id, name: guild.name },
  });
}

async function ensureUser(prisma, guildId, user) {
  return prisma.user.upsert({
    where: { guildId_userId: { guildId, userId: user.id } },
    update: {
      username: user.username,
      displayName: user.globalName || user.displayName || null,
      avatar: user.avatar || null,
      ...(user.joinedTimestamp
        ? { joinedAt: new Date(user.joinedTimestamp) }
        : {}),
    },
    create: {
      guildId,
      userId: user.id,
      username: user.username,
      displayName: user.globalName || user.displayName || null,
      avatar: user.avatar || null,
      ...(user.joinedTimestamp
        ? { joinedAt: new Date(user.joinedTimestamp) }
        : {}),
    },
  });
}

module.exports = { ensureGuild, ensureUser };
