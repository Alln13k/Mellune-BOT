const { prisma } = require('../../../../../database/client');
const {
  featureRoute,
  getResources,
  readBody,
  response,
  snowflake,
  text,
} = require('../../../../../lib/featureApi');

const DEFAULTS = {
  enabled: false,
  triggerChannelId: null,
  categoryId: null,
  nameFormat: "{username}'s room",
  userLimit: 0,
  defaultPrivacy: 'PUBLIC',
  maxRooms: 0,
  autoDelete: true,
  staffRoleIds: [],
};

const GET = featureRoute(async ({ guildId }) => {
  const [config, rooms, resources] = await Promise.all([
    prisma.temporaryVoiceConfig.findUnique({ where: { guildId } }),
    prisma.temporaryVoiceRoom.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    getResources(guildId),
  ]);
  return response({
    config: { ...DEFAULTS, ...config },
    rooms,
    channels: resources.channels,
  });
});

const POST = featureRoute(async ({ request, guildId }) => {
  const body = await readBody(request);
  const data = {
    enabled: body.enabled === true,
    triggerChannelId: snowflake(body.triggerChannelId),
    categoryId: snowflake(body.categoryId),
    nameFormat: text(body.nameFormat, 100, DEFAULTS.nameFormat),
    userLimit: Math.min(99, Math.max(0, Number(body.userLimit) || 0)),
    defaultPrivacy: body.defaultPrivacy === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
    maxRooms: Math.min(100, Math.max(0, Number(body.maxRooms) || 0)),
    autoDelete: body.autoDelete !== false,
    staffRoleIds: Array.isArray(body.staffRoleIds)
      ? body.staffRoleIds.map(snowflake).filter(Boolean).slice(0, 20)
      : [],
  };
  const config = await prisma.temporaryVoiceConfig.upsert({
    where: { guildId },
    update: data,
    create: { guildId, ...data },
  });
  return response({ config });
});

module.exports = { GET, POST };
