const { respondToEvent } = require('./eventService');

async function handleEventInteraction(interaction, prisma) {
  const [, action, rawId] = interaction.customId.split(':');
  const requested = action === 'tentative'
    ? 'TENTATIVE'
    : action === 'declined'
      ? 'DECLINED'
      : 'GOING';
  await interaction.deferReply({ ephemeral: true });
  const result = await respondToEvent(prisma, interaction.client, {
    guildId: interaction.guild.id,
    eventId: Number(rawId),
    requested,
    user: {
      userId: interaction.user.id,
      username: interaction.user.username,
      displayName: interaction.member?.displayName || interaction.user.globalName || interaction.user.username,
      avatar: interaction.user.avatar,
      roleIds: interaction.member?.roles?.cache ? [...interaction.member.roles.cache.keys()] : [],
    },
  });
  const content = result.decision.action === 'waitlist'
    ? `The event is full. You're on the waitlist (#${result.position}).`
    : result.decision.action === 'noop'
      ? 'Your response is already saved.'
      : result.decision.status === 'GOING'
        ? "You're going."
        : result.decision.status === 'TENTATIVE'
          ? "You're tentative."
          : 'You declined this event.';
  await interaction.editReply({ content });
  return true;
}

module.exports = { handleEventInteraction };
