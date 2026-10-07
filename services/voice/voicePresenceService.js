const {
  entersState,
  joinVoiceChannel,
  VoiceConnectionStatus,
} = require('@discordjs/voice');
const { prisma } = require('../../database/client');

const connections = new Map();
const retryTimers = new Map();

function clearRetry(guildId) {
  const timer = retryTimers.get(guildId);
  if (timer) clearTimeout(timer);
  retryTimers.delete(guildId);
}

function scheduleConnect(client, guildId, delay = 5000) {
  clearRetry(guildId);
  retryTimers.set(
    guildId,
    setTimeout(() => {
      retryTimers.delete(guildId);
      connectGuild(client, guildId).catch((error) =>
        console.error(`Voice presence reconnect failed for ${guildId}:`, error.message),
      );
    }, delay),
  );
}

async function connectGuild(client, guildId) {
  const config = await prisma.voicePresenceConfig.findUnique({ where: { guildId } });
  if (!config?.enabled || !config.channelId) return disconnectGuild(guildId);

  const guild = client.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(config.channelId);
  if (!guild || !channel || channel.type !== 2) {
    console.error(`Voice presence channel is unavailable for guild ${guildId}.`);
    return;
  }

  const existing = connections.get(guildId);
  if (existing && existing.joinConfig?.channelId === channel.id) return existing;
  disconnectGuild(guildId);

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
  });
  connections.set(guildId, connection);
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await entersState(connection, VoiceConnectionStatus.Signalling, 5_000);
    } catch {
      connection.destroy();
      connections.delete(guildId);
      scheduleConnect(client, guildId);
    }
  });
  connection.on(VoiceConnectionStatus.Destroyed, () => {
    if (connections.get(guildId) === connection) connections.delete(guildId);
  });
  return connection;
}

async function startVoicePresence(client) {
  const configs = await prisma.voicePresenceConfig.findMany({ where: { enabled: true } });
  await Promise.all(configs.map(({ guildId }) => connectGuild(client, guildId)));
  return () => stopVoicePresence();
}

function disconnectGuild(guildId) {
  clearRetry(guildId);
  const connection = connections.get(guildId);
  if (connection) connection.destroy();
  connections.delete(guildId);
}

function stopVoicePresence() {
  for (const guildId of new Set([...connections.keys(), ...retryTimers.keys()])) {
    disconnectGuild(guildId);
  }
}

module.exports = { startVoicePresence, stopVoicePresence, connectGuild };
