const { Events } = require('discord.js');
const { handleMemberJoin } = require('../services/welcome/welcomeService');
const { handleJoin } = require('../services/raidProtection/raidService');
const { recordActivity } = require('../services/activityService');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member, client) {
    try {
      await recordActivity(client.prisma, {
        guildId: member.guild.id,
        kind: 'JOIN',
        userId: member.id,
      });
      await handleJoin(member, client.prisma);
      await handleMemberJoin(client.prisma, member);
    } catch (error) {
      console.error('guildMemberAdd failed:', error.message);
    }
  },
};
