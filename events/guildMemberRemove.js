const { Events } = require('discord.js');
const { handleMemberLeave } = require('../services/welcome/welcomeService');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member, client) {
    try {
      await handleMemberLeave(client.prisma, member);
    } catch (error) {
      console.error('guildMemberRemove failed:', error.message);
    }
  },
};
