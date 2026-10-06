const { EmbedBuilder } = require('discord.js');
const { MELLUNE_PURPLE } = require('../../utils/embeds');

const EVENT_KEYS = {
  MEMBER_JOIN: 'memberJoin',
  MEMBER_LEAVE: 'memberLeave',
  MESSAGE_DELETE: 'messageDelete',
  MESSAGE_EDIT: 'messageEdit',
  MODERATION: 'moderation',
  ROLE_CHANGE: 'roleChange',
  CHANNEL_CHANGE: 'channelChange',
  TICKET: 'ticket',
  CONFIGURATION: 'configuration',
  AUTOMOD: 'automod',
  RAID: 'raid',
};

const DEFAULT_EVENTS = Object.fromEntries(
  Object.values(EVENT_KEYS).map((key) => [key, true]),
);

function getChannelId(config, event) {
  if (!config?.enabled) return null;
  const events =
    config.events && typeof config.events === 'object'
      ? config.events
      : DEFAULT_EVENTS;
  if (events[event] === false) return null;
  return events[event] && typeof events[event] === 'string'
    ? events[event]
    : config.memberLogId;
}

async function getLogConfig(prisma, guildId) {
  return prisma.logConfig.findUnique({ where: { guildId } });
}

async function sendLog(client, guild, event, title, description, fields = []) {
  const config = await getLogConfig(client.prisma, guild.id);
  const channelId = getChannelId(config, event);
  if (!channelId) return false;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return false;
  const embed = new EmbedBuilder()
    .setColor(MELLUNE_PURPLE)
    .setTitle(title)
    .setDescription(description || null)
    .setTimestamp();
  if (fields.length) embed.addFields(fields);
  await channel.send({ embeds: [embed] });
  return true;
}

module.exports = { DEFAULT_EVENTS, EVENT_KEYS, getLogConfig, sendLog };
