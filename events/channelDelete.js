const { Events } = require('discord.js');
const { sendLog, EVENT_KEYS } = require('../services/logging/logService');

module.exports = {
  name: Events.ChannelDelete,
  async execute(channel, client) {
    if (!channel.guild) return;
    await sendLog(
      client,
      channel.guild,
      EVENT_KEYS.CHANNEL_CHANGE,
      'Channel deleted',
      `#${channel.name} was deleted.`,
    ).catch(() => {});
  },
};
