const { Events } = require('discord.js');
const { ensureGuild } = require('../services/guildService');

module.exports = {
  name: Events.GuildCreate,
  async execute(guild, client) {
    await ensureGuild(client.prisma, guild);
    console.log(`Joined ${guild.name} (${guild.id}).`);
  },
};
