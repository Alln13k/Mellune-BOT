const { Events } = require('discord.js');
const { ensureGuild } = require('../services/guildService');
const { clearGuildSlashCommands } = require('../handlers/commandDeployer');

module.exports = {
  name: Events.GuildCreate,
  async execute(guild, client) {
    await ensureGuild(client.prisma, guild);
    try {
      await clearGuildSlashCommands(guild);
    } catch (error) {
      console.error(
        `Slash command cleanup failed for ${guild.id}:`,
        error.message,
      );
    }
    console.log(`Joined ${guild.name} (${guild.id}).`);
  },
};
