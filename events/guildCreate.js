const { Events } = require('discord.js');
const { ensureGuild } = require('../services/guildService');
const { deploySlashCommandsToGuild } = require('../handlers/commandDeployer');

module.exports = {
  name: Events.GuildCreate,
  async execute(guild, client) {
    await ensureGuild(client.prisma, guild);
    try {
      await deploySlashCommandsToGuild(guild, client.commands);
    } catch (error) {
      console.error(
        `Slash command deploy failed for ${guild.id}:`,
        error.message,
      );
    }
    console.log(`Joined ${guild.name} (${guild.id}).`);
  },
};
