const { ChannelType, PermissionFlagsBits } = require('discord.js');

const temporaryChannels = new Set();

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

  if (newState.channelId === config.triggerChannelId) {
    const parent = config.categoryId
      ? await guild.channels.fetch(config.categoryId).catch(() => null)
      : null;
    const channel = await guild.channels.create({
      name: formatName(config.nameFormat, newState.member),
      type: ChannelType.GuildVoice,
      parent:
        parent?.type === ChannelType.GuildCategory ? parent.id : undefined,
      userLimit: Math.max(0, Math.min(99, config.userLimit || 0)),
      permissionOverwrites: [
        {
          id: newState.member.id,
          allow: [
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers,
          ],
        },
      ],
    });
    temporaryChannels.add(channel.id);
    await newState.setChannel(channel).catch(async () => {
      await channel
        .delete('Could not move member into temporary channel')
        .catch(() => {});
    });
  }

  const oldChannel = oldState.channel;
  if (
    oldChannel &&
    temporaryChannels.has(oldChannel.id) &&
    oldChannel.members.size === 0
  ) {
    temporaryChannels.delete(oldChannel.id);
    await oldChannel.delete('Temporary voice channel is empty').catch(() => {});
  }
}

async function cleanupTemporaryChannels(client) {
  for (const guild of client.guilds.cache.values()) {
    const config = await client.prisma.temporaryVoiceConfig
      .findUnique({
        where: { guildId: guild.id },
      })
      .catch(() => null);
    if (!config) continue;
    const channels = guild.channels.cache.filter(
      (channel) =>
        channel.type === ChannelType.GuildVoice &&
        config.categoryId &&
        channel.parentId === config.categoryId &&
        channel.members.size === 0,
    );
    for (const channel of channels.values()) {
      await channel
        .delete('Cleaning empty temporary voice channel')
        .catch(() => {});
    }
  }
}

module.exports = {
  cleanupTemporaryChannels,
  formatName,
  handleVoiceStateUpdate,
};
