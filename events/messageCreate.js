const { Events } = require('discord.js');
const { addMessageXp } = require('../services/leveling/xpService');

module.exports = {
  name: Events.MessageCreate,
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;
    const settings = await client.prisma.guildSettings.findUnique({ where: { guildId: message.guild.id } });
    if (settings?.xpEnabled) await addMessageXp(client.prisma, message.guild.id, message.author.id);
  },
};
