const { prisma } = require('../../../../../database/client');
const { botFetch, guildResources } = require('../../../../../lib/discordRest');
const {
  featureRoute,
  readBody,
  response,
  snowflake,
  text,
} = require('../../../../../lib/featureApi');
const {
  formatChannelName,
  validateFormat,
} = require('../../../../../services/memberCounter/memberCounterService');

const DENY_CONNECT_SPEAK_STREAM_VAD = String(
  1048576 | 2097152 | 256 | 16777216,
);

async function currentCount(guildId) {
  const guild = await botFetch(`/guilds/${guildId}?with_counts=true`);
  const count = guild.member_count ?? guild.approximate_member_count;
  if (!Number.isInteger(count)) throw new Error('Discord member count is unavailable.');
  return count;
}

async function writeChannel(guildId, config, count) {
  const name = formatChannelName(config.format, count);
  const body = {
    name,
    type: 2,
    ...(config.categoryId ? { parent_id: config.categoryId } : {}),
    permission_overwrites: [{
      id: guildId,
      type: 0,
      deny: DENY_CONNECT_SPEAK_STREAM_VAD,
    }],
  };
  let channel = config.channelId
    ? await botFetch(`/channels/${config.channelId}`).catch(() => null)
    : null;
  if (channel?.type !== 2) channel = null;
  if (channel) {
    channel = await botFetch(`/channels/${channel.id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } else {
    channel = await botFetch(`/guilds/${guildId}/channels`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
  return { channel, name };
}

const GET = featureRoute(async ({ guildId }) => {
  const [config, resources, count] = await Promise.all([
    prisma.memberCounterConfig.findUnique({ where: { guildId } }),
    guildResources(guildId),
    currentCount(guildId).catch(() => null),
  ]);
  return response({
    config: config || {
      enabled: false,
      channelId: null,
      categoryId: null,
      format: '👥 Members: {membercount}',
      lastCount: count,
      lastSyncedAt: null,
    },
    count,
    categories: resources.channels.filter((channel) => channel.type === 4),
  });
});

const POST = featureRoute(async ({ request, guildId }) => {
  const body = await readBody(request);
  const existing = await prisma.memberCounterConfig.findUnique({
    where: { guildId },
  });
  if (body.action === 'sync') {
    if (!existing?.enabled) return response({ error: 'Member counter is disabled.' }, 400);
    const count = await currentCount(guildId);
    const result = await writeChannel(guildId, existing, count);
    const config = await prisma.memberCounterConfig.update({
      where: { guildId },
      data: { channelId: result.channel.id, lastCount: count, lastSyncedAt: new Date() },
    });
    return response({ config, count, channelName: result.name });
  }
  const enabled = body.enabled === true;
  const format = validateFormat(
    text(body.format, 200, existing?.format || '👥 Members: {membercount}'),
  );
  const categoryId = snowflake(body.categoryId) || null;
  if (!enabled) {
    if (body.deleteChannel === true && existing?.channelId) {
      await botFetch(`/channels/${existing.channelId}`, { method: 'DELETE' }).catch(
        () => null,
      );
    }
    const config = await prisma.memberCounterConfig.upsert({
      where: { guildId },
      update: { enabled: false, format, categoryId },
      create: { guildId, enabled: false, format, categoryId },
    });
    return response({ config });
  }
  const count = await currentCount(guildId);
  const data = { enabled: true, format, categoryId, lastCount: count };
  const draft = { ...(existing || {}), ...data, guildId };
  const result = await writeChannel(guildId, draft, count);
  const config = await prisma.memberCounterConfig.upsert({
    where: { guildId },
    update: {
      enabled: true,
      format,
      categoryId,
      channelId: result.channel.id,
      lastCount: count,
      lastSyncedAt: new Date(),
    },
    create: {
      guildId,
      enabled: true,
      format,
      categoryId,
      channelId: result.channel.id,
      lastCount: count,
      lastSyncedAt: new Date(),
    },
  });
  return response({ config, count, channelName: result.name });
});

module.exports = { GET, POST };
