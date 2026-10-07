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
    ? `This event is full. You're on the waitlist (#${result.position}). We'll DM you if a spot opens.`
    : result.decision.action === 'noop'
      ? 'That answer is already saved.'
      : result.decision.status === 'GOING'
        ? "You're going. You'll get a DM 15 minutes before and when it starts."
        : result.decision.status === 'TENTATIVE'
          ? "You're marked as maybe. Only people who are going get the automatic reminders."
          : "You're marked as can't go.";
  await interaction.editReply({ content });
  return true;
}

module.exports = { handleEventInteraction };
