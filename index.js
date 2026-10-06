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
const { startJobWorker } = require('./services/scheduler/jobWorker');
const {
  cleanupTemporaryChannels,
} = require('./services/voice/tempVoiceService');

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
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
  });
  client.prisma = prisma;
  client.stopJobWorker = null;

  const commands = loadCommands(path.join(__dirname, 'commands'));
  client.commands = commands;
  loadEvents(client, path.join(__dirname, 'events'));
  attachInteractionHandler(client, commands, prisma);
  client.once('ready', async () => {
    await cleanupTemporaryChannels(client).catch((error) =>
      console.error('Temporary voice cleanup failed:', error.message),
    );
    client.stopJobWorker = startJobWorker(client);
  });

  client.on('error', (error) => console.error('Discord client error:', error));
  process.on('unhandledRejection', (error) =>
    console.error('Unhandled promise rejection:', error),
  );
  process.on('uncaughtException', (error) =>
    console.error('Uncaught exception:', error),
  );
  process.once('SIGINT', async () => {
    client.stopJobWorker?.();
    client.stopMemberCounterSync?.();
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
