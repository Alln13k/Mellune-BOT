const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const { MELLUNE_DEFAULT_COLOR_INT } = require('../../utils/embeds');

async function startGiveaway(client, giveaway) {
  const channel = await client.channels.fetch(giveaway.channelId);
  if (!channel?.isTextBased())
    throw new Error('Giveaway channel is not text-based.');
  const embed = new EmbedBuilder()
    .setColor(MELLUNE_DEFAULT_COLOR_INT)
    .setTitle(`🎁 ${giveaway.prize}`)
    .setDescription(
      `Click **Enter** to participate.\nEnds <t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>\nWinners: **${giveaway.winners}**`,
    )
    .setFooter({ text: `Giveaway #${giveaway.id}` });
  if (giveaway.requiredRoleId) {
    embed.addFields({
      name: 'Requirement',
      value: `<@&${giveaway.requiredRoleId}>`,
    });
  }
  const message = await channel.send({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway-enter:${giveaway.id}`)
          .setLabel('Enter')
          .setStyle(ButtonStyle.Primary),
      ),
    ],
  });
  return client.prisma.giveaway.update({
    where: { id: giveaway.id },
    data: { messageId: message.id, status: 'ACTIVE' },
  });
}

async function enterGiveaway(prisma, giveawayId, userId, member) {
  const giveaway = await prisma.giveaway.findUnique({
    where: { id: giveawayId },
  });
  if (
    !giveaway ||
    giveaway.status !== 'ACTIVE' ||
    giveaway.endsAt <= new Date()
  ) {
    return { ok: false, message: 'This giveaway has ended.' };
  }
  if (
    giveaway.requiredRoleId &&
    !member?.roles.cache.has(giveaway.requiredRoleId)
  ) {
    return { ok: false, message: 'You do not meet the role requirement.' };
  }
  await prisma.giveawayEntry.upsert({
    where: { giveawayId_userId: { giveawayId, userId } },
    update: {},
    create: { giveawayId, userId },
  });
  return { ok: true, message: 'You are entered.' };
}

function pickWinners(entries, count) {
  const pool = [...entries];
  const winners = [];
  while (pool.length && winners.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(index, 1)[0].userId);
  }
  return winners;
}

async function processEndedGiveaways(client) {
  const giveaways = await client.prisma.giveaway.findMany({
    where: { status: 'ACTIVE', endsAt: { lte: new Date() } },
    include: { entries: true },
    take: 25,
  });
  for (const giveaway of giveaways) {
    const winners = pickWinners(giveaway.entries, giveaway.winners);
    await client.prisma.giveaway.update({
      where: { id: giveaway.id },
      data: { status: 'ENDED', winnerIds: winners },
    });
    if (giveaway.channelId) {
      const channel = await client.channels
        .fetch(giveaway.channelId)
        .catch(() => null);
      const message = giveaway.messageId
        ? await channel?.messages.fetch(giveaway.messageId).catch(() => null)
        : null;
      const result = winners.length
        ? winners.map((id) => `<@${id}>`).join(', ')
        : 'No eligible entrants.';
      await channel?.send(
        `🎉 Giveaway **${giveaway.prize}** ended! Winners: ${result}`,
      );
      await message?.edit({ components: [] }).catch(() => {});
    }
  }
}

async function rerollGiveaway(client, giveawayId) {
  const giveaway = await client.prisma.giveaway.findUnique({
    where: { id: giveawayId },
    include: { entries: true },
  });
  if (!giveaway || giveaway.status !== 'ENDED')
    throw new Error('Giveaway is not ended.');
  const winners = pickWinners(giveaway.entries, giveaway.winners);
  await client.prisma.giveaway.update({
    where: { id: giveawayId },
    data: { winnerIds: winners },
  });
  return winners;
}

module.exports = {
  enterGiveaway,
  pickWinners,
  processEndedGiveaways,
  rerollGiveaway,
  startGiveaway,
};
