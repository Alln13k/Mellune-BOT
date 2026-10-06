require('dotenv').config();

const path = require('node:path');
const { REST, Routes } = require('discord.js');
const { loadCommands } = require('../handlers/commandLoader');
const { validateEnvironment } = require('../utils/config');

async function deploy() {
  validateEnvironment();
  const scope = process.argv[2];
  if (!['guild', 'global'].includes(scope))
    throw new Error('Usage: npm run deploy:guild or npm run deploy:global');
  if (scope === 'guild' && !process.env.DEV_GUILD_ID)
    throw new Error('DEV_GUILD_ID is required for guild deployment.');
  const commands = [
    ...loadCommands(path.join(__dirname, '..', 'commands')).values(),
  ].map((command) => command.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const route =
    scope === 'guild'
      ? Routes.applicationGuildCommands(
          process.env.DISCORD_CLIENT_ID,
          process.env.DEV_GUILD_ID,
        )
      : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);
  await rest.put(route, { body: commands });
  console.log(`Deployed ${commands.length} ${scope} command(s).`);
}

deploy().catch((error) => {
  console.error('Command deployment failed:', error.message);
  process.exitCode = 1;
});
