const DEFAULT_REASON = 'No reason provided.';

async function createCase(
  prisma,
  { guild, target, moderator, action, reason },
) {
  await prisma.guild.upsert({
    where: { id: guild.id },
    update: {},
    create: { id: guild.id, name: guild.name },
  });
  await prisma.user.upsert({
    where: { guildId_userId: { guildId: guild.id, userId: target.id } },
    update: { username: target.user.username },
    create: {
      guildId: guild.id,
      userId: target.id,
      username: target.user.username,
    },
  });
  return prisma.moderationCase.create({
    data: {
      guildId: guild.id,
      targetId: target.id,
      moderatorId: moderator.id,
      action,
      reason: reason || DEFAULT_REASON,
    },
  });
}

module.exports = { createCase, DEFAULT_REASON };
