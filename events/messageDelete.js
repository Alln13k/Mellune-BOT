const { Events } = require('discord.js');
const { sendLog, EVENT_KEYS } = require('../services/logging/logService');
const { recordActivity } = require('../services/activityService');

module.exports = {
  name: Events.MessageDelete,
  async execute(message, client) {
    if (!message.guild || message.author?.bot) return;
    await recordActivity(client.prisma, {
      guildId: message.guild.id,
      kind: 'MESSAGE_DELETE',
      userId: message.author?.id,
      channelId: message.channel.id,
    }).catch(() => {});
    await sendLog(
      client,
      message.guild,
      EVENT_KEYS.MESSAGE_DELETE,
      'Message deleted',
      `A message was deleted in ${message.channel}.`,
      message.author
        ? [{ name: 'Author', value: `${message.author}`, inline: true }]
        : [],
    ).catch(() => {});
  },
};
