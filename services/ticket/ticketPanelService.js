const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const { buildEmbed } = require('../embedService');
const { MELLUNE_PURPLE } = require('../../utils/embeds');

const BUTTON_STYLES = {
  PRIMARY: ButtonStyle.Primary,
  SECONDARY: ButtonStyle.Secondary,
  SUCCESS: ButtonStyle.Success,
  DANGER: ButtonStyle.Danger,
};

async function publishTicketPanel(client, guildId, channelId, panelId) {
  const guild = await client.guilds.fetch(guildId);
  const panel = await client.prisma.ticketPanel.findFirst({
    where: {
      guildId,
      ...(panelId ? { id: panelId } : { enabled: true }),
    },
    include: {
      categories: { where: { enabled: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!panel) throw new Error('Create a ticket panel before publishing it.');
  const channel = await guild.channels.fetch(channelId || panel.channelId);
  if (!channel?.isTextBased())
    throw new Error('Ticket panel channel is not text-based.');
  const embed = panel.payload
    ? buildEmbed(panel.payload)
    : new EmbedBuilder()
        .setColor(panel.color || MELLUNE_PURPLE)
        .setTitle(`${panel.emoji || ''} ${panel.title}`.trim())
        .setDescription(panel.description);
  if (panel.footer && !panel.payload?.footer)
    embed.setFooter({ text: panel.footer });
  if (panel.imageUrl && !panel.payload?.image)
    embed.setImage(panel.imageUrl);
  const style = BUTTON_STYLES[panel.buttonStyle] || ButtonStyle.Secondary;
  const rows = [];
  for (let index = 0; index < panel.categories.length; index += 5) {
    rows.push(
      new ActionRowBuilder().addComponents(
        ...panel.categories.slice(index, index + 5).map((category) => {
          const button = new ButtonBuilder()
            .setCustomId(`ticket-open:${panel.id}:${category.id}`)
            .setLabel(category.name)
            .setStyle(style);
          if (category.emoji) button.setEmoji(category.emoji);
          return button;
        }),
      ),
    );
  }
  if (!rows.length && panel.enabled) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket-open:${panel.id}:0`)
          .setLabel(panel.buttonLabel)
          .setStyle(style)
          .setEmoji(panel.buttonEmoji || '🎫'),
      ),
    );
  }
  let message = null;
  if (panel.messageId && channel.messages) {
    message = await channel.messages
      ?.fetch(panel.messageId)
      .then((existing) =>
        existing.edit({ embeds: [embed], components: rows }),
      )
      .catch(() => null);
  }
  message ||= await channel.send({ embeds: [embed], components: rows });
  await client.prisma.ticketPanel.update({
    where: { id: panel.id },
    data: { channelId: channel.id, messageId: message.id },
  });
  return message;
}

module.exports = { publishTicketPanel };
