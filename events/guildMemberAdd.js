const { Events } = require('discord.js');
const { handleMemberJoin } = require('../services/welcome/welcomeService');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member, client) {
    try {
      await handleMemberJoin(client.prisma, member);
    } catch (error) {
      console.error('guildMemberAdd failed:', error.message);
    }
  },
};
