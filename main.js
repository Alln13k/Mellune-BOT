require('dotenv').config();

const path = require('node:path');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const {
  connectDatabase,
  disconnectDatabase,
  prisma,
} = require('./database/client');
const { validateEnvironment } = require('./utils/config');
const { loadCommands } = require('./handlers/commandLoader');
const { loadEvents } = require('./handlers/eventLoader');
const { attachInteractionHandler } = require('./handlers/interactionHandler');

async function start() {
  validateEnvironment();
  await connectDatabase();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.Channel, Partials.Message],
  });
  client.prisma = prisma;

  const commands = loadCommands(path.join(__dirname, 'commands'));
  loadEvents(client, path.join(__dirname, 'events'));
  attachInteractionHandler(client, commands, prisma);

  client.on('error', (error) => console.error('Discord client error:', error));
  process.on('unhandledRejection', (error) =>
    console.error('Unhandled promise rejection:', error),
  );
  process.on('uncaughtException', (error) =>
    console.error('Uncaught exception:', error),
  );
  process.once('SIGINT', async () => {
    await client.destroy();
    await disconnectDatabase();
    process.exit(0);
  });

  await client.login(process.env.DISCORD_TOKEN);
}

start().catch(async (error) => {
  console.error('Mellune failed to start:', error.message);
  await disconnectDatabase().catch(() => {});
  process.exitCode = 1;
});
