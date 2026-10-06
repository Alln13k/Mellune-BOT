const { buildEmbed, memberContext } = require('../embedService');
const { MELLUNE_DEFAULT_EMBED_COLOR } = require('../../lib/constants');
const { sendLog, EVENT_KEYS } = require('../logging/logService');
const { ensureGuild, ensureUser } = require('../guildService');

const DEFAULT_GREETING = {
  enabled: false,
  channelId: null,
  title: null,
  description: null,
  color: MELLUNE_DEFAULT_EMBED_COLOR,
  footer: null,
  thumbnailUrl: null,
  imageUrl: null,
  useTimestamp: true,
  authorName: 'Mellune',
  authorIconUrl: null,
  mentionMode: 'USER',
  dmEnabled: false,
  autoRoleId: null,
};

function legacyGreeting(config, kind) {
  if (!config) return null;
  return {
    ...DEFAULT_GREETING,
    enabled: config.enabled,
    channelId: config.channelId,
    description: kind === 'WELCOME' ? config.welcomeText : config.leaveText,
    dmEnabled: kind === 'WELCOME' && config.dmEnabled,
    autoRoleId: kind === 'WELCOME' ? config.autoRoleId : null,
  };
}

async function getGreeting(prisma, guildId, kind) {
  const config = prisma.greetingConfig
    ? await prisma.greetingConfig.findUnique({
        where: { guildId_kind: { guildId, kind } },
      })
    : null;
  if (config) return { ...DEFAULT_GREETING, ...config };
  const legacy = await prisma.welcomeConfig.findUnique({ where: { guildId } });
  return legacyGreeting(legacy, kind);
}

function allowedMentions(config, member) {
  if (config.mentionMode === 'EVERYONE') {
    return { parse: ['everyone'], users: [], roles: [] };
  }
  if (config.mentionMode === 'USER') {
    return { parse: [], users: [member.id], roles: [] };
  }
  return { parse: [], users: [], roles: [] };
}

async function sendGreeting(member, config, kind) {
  if (!config?.enabled || !config.channelId) return false;
  const channel = await member.guild.channels
    .fetch(config.channelId)
    .catch(() => null);
  if (!channel?.isTextBased()) return false;
  const context = memberContext(member);
  const payload = {
    embeds: [
      buildEmbed(
        {
          title: config.title || (kind === 'WELCOME' ? 'Welcome' : 'Goodbye'),
          description:
            config.description ||
            (kind === 'WELCOME'
              ? 'Welcome {user} to {server}.'
              : '{username} has left {server}.'),
          color: config.color,
          footer: config.footer ? { text: config.footer } : undefined,
          thumbnail: {
            url: config.thumbnailUrl || context.avatar,
          },
          image: config.imageUrl ? { url: config.imageUrl } : undefined,
          timestamp: config.useTimestamp,
          author: config.authorName
            ? {
                name: config.authorName,
                iconUrl: config.authorIconUrl || context.avatar,
              }
            : undefined,
        },
        context,
      ),
    ],
    allowedMentions: allowedMentions(config, member),
  };
  if (config.mentionMode === 'USER') payload.content = `<@${member.id}>`;
  if (config.mentionMode === 'EVERYONE') payload.content = '@everyone';
  await channel.send(payload);
  return true;
}

async function sendGreetingTest(client, guildId, userId, kind) {
  const guild = await client.guilds.fetch(guildId);
  const member = await guild.members.fetch(userId);
  const config = await getGreeting(client.prisma, guildId, kind);
  if (!config?.channelId) throw new Error('Choose a greeting channel first.');
  return sendGreeting(member, config, kind);
}

async function handleMemberJoin(prisma, member) {
  await ensureGuild(prisma, member.guild);
  await ensureUser(prisma, member.guild.id, member.user);
  const config = await getGreeting(prisma, member.guild.id, 'WELCOME');
  if (member.user.bot) return;
  if (!config?.enabled) {
    await sendLog(
      member.client,
      member.guild,
      EVENT_KEYS.MEMBER_JOIN,
      'Member joined',
      `${member.user} joined the server.`,
    ).catch(() => {});
    return;
  }

  if (config.autoRoleId) {
    await member.roles
      .add(config.autoRoleId, 'Mellune welcome auto-role')
      .catch((error) =>
        console.error('Auto-role failed:', member.guild.id, error.message),
      );
  }
  await sendGreeting(member, config, 'WELCOME').catch((error) =>
    console.error('Welcome message failed:', member.guild.id, error.message),
  );
  if (config.dmEnabled && config.description) {
    await member
      .send({
        embeds: [
          buildEmbed(
            {
              title: config.title || 'Welcome',
              description: config.description,
              color: config.color,
            },
            memberContext(member),
          ),
        ],
        allowedMentions: { parse: [], users: [], roles: [] },
      })
      .catch(() => null);
  }
  await sendLog(
    member.client,
    member.guild,
    EVENT_KEYS.MEMBER_JOIN,
    'Member joined',
    `${member.user} joined the server.`,
  ).catch(() => {});
}

async function handleMemberLeave(prisma, member) {
  const config = await getGreeting(prisma, member.guild.id, 'GOODBYE');
  if (member.user?.bot) return;
  if (!config?.enabled) {
    await sendLog(
      member.client,
      member.guild,
      EVENT_KEYS.MEMBER_LEAVE,
      'Member left',
      `${member.user?.tag || member.id} left the server.`,
    ).catch(() => {});
    return;
  }
  await sendGreeting(member, config, 'GOODBYE').catch((error) =>
    console.error('Leave message failed:', member.guild.id, error.message),
  );
  await sendLog(
    member.client,
    member.guild,
    EVENT_KEYS.MEMBER_LEAVE,
    'Member left',
    `${member.user?.tag || member.id} left the server.`,
  ).catch(() => {});
}

module.exports = {
  DEFAULT_GREETING,
  getGreeting,
  handleMemberJoin,
  handleMemberLeave,
  sendGreeting,
  sendGreetingTest,
};
