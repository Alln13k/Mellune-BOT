const { NextResponse } = require('next/server');
const { prisma } = require('../../../../../database/client');
const { guildRoute, badRequest } = require('../../../../../lib/guildRoute');
const {
  getResources,
  snowflake,
  text,
} = require('../../../../../lib/featureApi');

const GET = guildRoute(async ({ guildId }) => {
  const [settings, top, total, resources] = await Promise.all([
    prisma.guildSettings.findUnique({ where: { guildId } }),
    prisma.levelUser.findMany({
      where: { guildId },
      orderBy: { xp: 'desc' },
      take: 10,
    }),
    prisma.levelUser.count({ where: { guildId } }),
    getResources(guildId),
  ]);
  const users = await prisma.user.findMany({
    where: { guildId, userId: { in: top.map((entry) => entry.userId) } },
    select: { userId: true, username: true },
  });
  const names = new Map(users.map((user) => [user.userId, user.username]));
  return NextResponse.json({
    enabled: Boolean(settings?.xpEnabled),
    levelUpEnabled: Boolean(settings?.levelUpEnabled),
    levelUpChannelId: settings?.levelUpChannelId || '',
    levelUpPayload: settings?.levelUpPayload || {},
    levelUpMention: settings?.levelUpMention !== false,
    channels: resources.channels.filter((channel) => [0, 5].includes(channel.type)),
    total,
    leaderboard: top.map((entry) => ({
      userId: entry.userId,
      username: names.get(entry.userId) ?? null,
      xp: entry.xp,
      level: entry.level,
      messages: entry.messages,
    })),
  });
});

const POST = guildRoute(async ({ request, guildId }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body.');
  }
  if (typeof body.enabled !== 'boolean') {
    return badRequest('"enabled" must be true or false.');
  }
  const levelUpChannelId = snowflake(body.levelUpChannelId) || null;
  if (levelUpChannelId) {
    const resources = await getResources(guildId);
    const channel = resources.channels.find(
      (item) => item.id === levelUpChannelId && [0, 5].includes(item.type),
    );
    if (!channel) return badRequest('Choose a text channel from this server.');
  }
  const levelUpPayload =
    body.levelUpPayload && typeof body.levelUpPayload === 'object'
      ? {
          title: text(body.levelUpPayload.title, 256) || 'Level up!',
          description:
            text(body.levelUpPayload.description, 4096) ||
            '🎉 {user} reached level {level}!',
          footer: text(body.levelUpPayload.footer, 2048) || null,
          timestamp: body.levelUpPayload.timestamp === true,
        }
      : null;
  const settings = await prisma.guildSettings.upsert({
    where: { guildId },
    update: {
      xpEnabled: body.enabled,
      ...(typeof body.levelUpEnabled === 'boolean'
        ? { levelUpEnabled: body.levelUpEnabled }
        : {}),
      ...(typeof body.levelUpChannelId === 'string'
        ? { levelUpChannelId }
        : {}),
      ...(body.levelUpPayload && typeof body.levelUpPayload === 'object'
        ? { levelUpPayload }
        : {}),
      ...(typeof body.levelUpMention === 'boolean'
        ? { levelUpMention: body.levelUpMention }
        : {}),
    },
    create: {
      guildId,
      xpEnabled: body.enabled,
      levelUpEnabled: body.levelUpEnabled === true,
      levelUpChannelId,
      levelUpPayload,
      levelUpMention: body.levelUpMention !== false,
    },
  });
  return NextResponse.json({
    enabled: settings.xpEnabled,
    levelUpEnabled: settings.levelUpEnabled,
    levelUpChannelId: settings.levelUpChannelId || '',
    levelUpPayload: settings.levelUpPayload || {},
    levelUpMention: settings.levelUpMention,
  });
});

module.exports = { GET, POST };
