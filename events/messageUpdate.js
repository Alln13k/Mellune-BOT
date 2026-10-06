const { Events } = require('discord.js');
const { sendLog, EVENT_KEYS } = require('../services/logging/logService');

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage, client) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    await sendLog(
      client,
      newMessage.guild,
      EVENT_KEYS.MESSAGE_EDIT,
      'Message edited',
      `A message was edited in ${newMessage.channel}.`,
      [
        {
          name: 'Before',
          value: oldMessage.content?.slice(0, 1024) || 'Unavailable',
        },
        {
          name: 'After',
          value: newMessage.content?.slice(0, 1024) || 'Unavailable',
        },
      ],
    ).catch(() => {});
  },
};
