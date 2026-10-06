const { Events } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(
      `Mellune is online as ${client.user.tag} in ${client.guilds.cache.size} server(s).`,
    );
  },
};
