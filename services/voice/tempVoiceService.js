const { createVoiceRoom } = require('./voiceRoomService');

const roomCreationLocks = new Set();

function formatName(format, member) {
  return (format || "{username}'s room")
    .replace(/\{username\}/gi, member.user.username)
    .replace(/\{displayname\}/gi, member.displayName)
    .slice(0, 100);
}

async function handleVoiceStateUpdate(oldState, newState, prisma) {
  const guild = newState.guild || oldState.guild;
  if (!guild) return;
  const config = await prisma.temporaryVoiceConfig.findUnique({
    where: { guildId: guild.id },
  });
  if (!config?.enabled) return;

  if (
    newState.channelId === config.triggerChannelId &&
    oldState.channelId !== newState.channelId &&
    !roomCreationLocks.has(newState.member.id)
  ) {
    roomCreationLocks.add(newState.member.id);
    try {
      await createVoiceRoom({ newState, prisma, config, formatName });
    } finally {
      roomCreationLocks.delete(newState.member.id);
    }
  }

  const oldChannel = oldState.channel;
  if (oldChannel && oldChannel.members.size === 0 && config.autoDelete !== false) {
    const room = await prisma.temporaryVoiceRoom.findUnique({
      where: { channelId: oldChannel.id },
    });
    if (room) {
      await prisma.temporaryVoiceRoom
        .delete({ where: { id: room.id } })
        .catch(() => {});
      await oldChannel.delete('Temporary voice channel is empty').catch(() => {});
    }
  }
}

async function cleanupTemporaryChannels(client) {
  for (const guild of client.guilds.cache.values()) {
    const rooms = await client.prisma.temporaryVoiceRoom
      .findMany({ where: { guildId: guild.id } })
      .catch(() => []);
    const config = await client.prisma.temporaryVoiceConfig.findUnique({
      where: { guildId: guild.id },
    });
    for (const room of rooms) {
      const channel =
        guild.channels.cache.get(room.channelId) ||
        (await guild.channels.fetch(room.channelId).catch(() => null));
      if (!channel) {
        await client.prisma.temporaryVoiceRoom
          .delete({ where: { id: room.id } })
          .catch(() => {});
        continue;
      }
      if (config?.autoDelete !== false && channel.members.size === 0) {
        await client.prisma.temporaryVoiceRoom
          .delete({ where: { id: room.id } })
          .catch(() => {});
        await channel
          .delete('Cleaning empty temporary voice channel')
          .catch(() => {});
      }
    }
  }
}

module.exports = {
  cleanupTemporaryChannels,
  formatName,
  handleVoiceStateUpdate,
};
