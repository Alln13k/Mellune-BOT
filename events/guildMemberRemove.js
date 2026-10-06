const { Events } = require('discord.js');
const { handleMemberLeave } = require('../services/welcome/welcomeService');
const { recordActivity } = require('../services/activityService');
const { syncMemberCounter } = require('../services/memberCounter/memberCounterService');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member, client) {
    try {
      await recordActivity(client.prisma, {
        guildId: member.guild.id,
        kind: 'LEAVE',
        userId: member.id,
      });
      await handleMemberLeave(client.prisma, member);
      await syncMemberCounter(client, member.guild.id);
    } catch (error) {
      console.error('guildMemberRemove failed:', error.message);
    }
  },
};
