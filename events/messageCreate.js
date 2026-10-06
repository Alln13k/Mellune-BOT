const { Events } = require('discord.js');
const { addMessageXp } = require('../services/leveling/xpService');
const { inspectMessage } = require('../services/automod/automodService');
const { ensureGuild, ensureUser } = require('../services/guildService');
const { recordActivity } = require('../services/activityService');

module.exports = {
  name: Events.MessageCreate,
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;
    await ensureGuild(client.prisma, message.guild);
    await ensureUser(client.prisma, message.guild.id, message.author);
    await recordActivity(client.prisma, {
      guildId: message.guild.id,
      kind: 'MESSAGE',
      userId: message.author.id,
      channelId: message.channel.id,
    });
    const settings = await client.prisma.guildSettings.findUnique({
      where: { guildId: message.guild.id },
    });
    if (
      settings?.suggestionEnabled &&
      settings.suggestionChannelId === message.channel.id
    ) {
      const suggestion = await client.prisma.suggestion.create({
        data: {
          guildId: message.guild.id,
          channelId: message.channel.id,
          messageId: message.id,
          authorId: message.author.id,
          content: message.content.slice(0, 4000),
        },
      });
      await message.react('✅').catch(() => {});
      await message.react('❌').catch(() => {});
      await message
        .startThread({
          name: `Suggestion #${suggestion.id}`,
          reason: 'Mellune suggestion discussion',
        })
        .catch(() => {});
      return;
    }
    if (await inspectMessage(message, client.prisma)) return;
    if (settings?.xpEnabled)
      await addMessageXp(client.prisma, message.guild.id, message.author.id);
  },
};
