const { Events } = require('discord.js');
const { deploySlashCommands } = require('../handlers/commandDeployer');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(
      `Mellune is online as ${client.user.tag} in ${client.guilds.cache.size} server(s).`,
    );
    try {
      await deploySlashCommands(client, client.commands);
    } catch (error) {
      console.error('Slash command deploy failed:', error.message);
    }
  },
};
