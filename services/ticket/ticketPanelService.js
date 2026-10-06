const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const { MELLUNE_PURPLE } = require('../../utils/embeds');

async function publishTicketPanel(client, guildId, channelId) {
  const guild = await client.guilds.fetch(guildId);
  const panel = await client.prisma.ticketPanel.findUnique({
    where: { guildId },
    include: {
      categories: { where: { enabled: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!panel) throw new Error('Create a ticket panel before publishing it.');
  const channel = await guild.channels.fetch(channelId || panel.channelId);
  if (!channel?.isTextBased())
    throw new Error('Ticket panel channel is not text-based.');
  const embed = new EmbedBuilder()
    .setColor(panel.color || MELLUNE_PURPLE)
    .setTitle(`${panel.emoji || ''} ${panel.title}`.trim())
    .setDescription(panel.description);
  if (panel.footer) embed.setFooter({ text: panel.footer });
  if (panel.imageUrl) embed.setImage(panel.imageUrl);
  const rows = [];
  for (let index = 0; index < panel.categories.length; index += 5) {
    rows.push(
      new ActionRowBuilder().addComponents(
        ...panel.categories.slice(index, index + 5).map((category) =>
          new ButtonBuilder()
            .setCustomId(`ticket-open:${category.id}`)
            .setLabel(category.name)
            .setEmoji(category.emoji || '✦')
            .setStyle(ButtonStyle.Secondary),
        ),
      ),
    );
  }
  const message = await channel.send({ embeds: [embed], components: rows });
  await client.prisma.ticketPanel.update({
    where: { id: panel.id },
    data: { channelId: channel.id, messageId: message.id },
  });
  return message;
}

module.exports = { publishTicketPanel };
