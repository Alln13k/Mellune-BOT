const path = require('node:path');
const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./commandLoader');

function getSlashCommandPayload(commands) {
  const source =
    commands ?? loadCommands(path.join(__dirname, '..', 'commands'));
  return [...source.values()].map((command) => command.data.toJSON());
}

async function deploySlashCommands(client, commands) {
  const payload = getSlashCommandPayload(commands);
  if (!client.application?.commands?.set) {
    throw new Error('Discord application is not ready.');
  }

  await client.application.commands.set(payload);
  console.log(`Pushed ${payload.length} slash command(s) globally.`);

  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set(payload);
    console.log(
      `Pushed ${payload.length} slash command(s) to ${guild.name} (${guild.id}).`,
    );
  }

  return payload.length;
}

async function deploySlashCommandsToGuild(guild, commands) {
  const payload = getSlashCommandPayload(commands);
  await guild.commands.set(payload);
  console.log(
    `Pushed ${payload.length} slash command(s) to ${guild.name} (${guild.id}).`,
  );
  return payload.length;
}

async function deploySlashCommandsViaRest(scope, env = process.env) {
  if (!['guild', 'global'].includes(scope)) {
    throw new Error('Usage: npm run deploy:guild or npm run deploy:global');
  }
  if (scope === 'guild' && !env.DEV_GUILD_ID) {
    throw new Error('DEV_GUILD_ID is required for guild deployment.');
  }

  const payload = getSlashCommandPayload();
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  const route =
    scope === 'guild'
      ? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DEV_GUILD_ID)
      : Routes.applicationCommands(env.DISCORD_CLIENT_ID);
  await rest.put(route, { body: payload });
  console.log(`Deployed ${payload.length} ${scope} command(s).`);
  return payload.length;
}

module.exports = {
  getSlashCommandPayload,
  deploySlashCommands,
  deploySlashCommandsToGuild,
  deploySlashCommandsViaRest,
};
