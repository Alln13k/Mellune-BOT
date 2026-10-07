function reactionKeys(reaction) {
  const emoji = reaction.emoji;
  return new Set(
    [emoji.name, emoji.toString(), emoji.identifier].filter(Boolean),
  );
}

async function findReactionEntry(reaction, prisma) {
  const messageId = reaction.message.id;
  const guildId = reaction.message.guild?.id;
  if (!guildId) return null;
  const entries = await prisma.reactionRole.findMany({
    where: { guildId, messageId, enabled: true },
    include: { panel: true },
  });
  const keys = reactionKeys(reaction);
  return entries.find((entry) => keys.has(entry.emoji)) || null;
}

async function handleReaction(reaction, user, prisma, adding) {
  if (user?.bot) return;
  if (reaction.partial) await reaction.fetch();
  const entry = await findReactionEntry(reaction, prisma);
  if (!entry) return;
  const member = await reaction.message.guild.members
    .fetch(user.id)
    .catch(() => null);
  const role = await reaction.message.guild.roles.fetch(entry.roleId).catch(() => null);
  const botHighest =
    reaction.message.guild.members.me?.roles.highest.position || 0;
  if (!member || !role || role.managed || role.position >= botHighest) return;

  if (adding && entry.panel?.exclusiveMode === 'EXCLUSIVE') {
    const siblings = await prisma.reactionRole.findMany({
      where: {
        panelId: entry.panelId,
        enabled: true,
        id: { not: entry.id },
      },
    });
    for (const sibling of siblings) {
      if (member.roles.cache.has(sibling.roleId)) {
        const siblingRole = await reaction.message.guild.roles
          .fetch(sibling.roleId)
          .catch(() => null);
        if (siblingRole && siblingRole.position < botHighest)
          await member.roles.remove(siblingRole, 'Exclusive Mellune reaction role');
      }
    }
  }
  if (adding) await member.roles.add(role, 'Mellune reaction role');
  else if (member.roles.cache.has(role.id))
    await member.roles.remove(role, 'Mellune reaction role');
}

module.exports = { findReactionEntry, handleReaction, reactionKeys };
