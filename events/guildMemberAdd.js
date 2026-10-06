const { Events } = require('discord.js');
const { handleMemberJoin } = require('../services/welcome/welcomeService');
const { handleJoin } = require('../services/raidProtection/raidService');
const { recordActivity } = require('../services/activityService');
const { syncMemberCounter } = require('../services/memberCounter/memberCounterService');
const { applyAutoRoles } = require('../services/autoRoles/autoRoleService');
const { ensureUser } = require('../services/guildService');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member, client) {
    try {
      await recordActivity(client.prisma, {
        guildId: member.guild.id,
        kind: 'JOIN',
        userId: member.id,
      });
      await ensureUser(client.prisma, member.guild.id, {
        ...member.user,
        joinedTimestamp: member.joinedTimestamp,
      });
      await handleJoin(member, client.prisma);
      await handleMemberJoin(client.prisma, member);
      await applyAutoRoles(member, client.prisma);
      await syncMemberCounter(client, member.guild.id);
    } catch (error) {
      console.error('guildMemberAdd failed:', error.message);
    }
  },
};
