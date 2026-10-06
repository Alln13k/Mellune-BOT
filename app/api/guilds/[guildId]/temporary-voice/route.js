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
};

const GET = featureRoute(async ({ guildId }) => {
  const [config, resources] = await Promise.all([
    prisma.temporaryVoiceConfig.findUnique({ where: { guildId } }),
    getResources(guildId),
  ]);
  return response({
    config: { ...DEFAULTS, ...config },
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
  };
  const config = await prisma.temporaryVoiceConfig.upsert({
    where: { guildId },
    update: data,
    create: { guildId, ...data },
  });
  return response({ config });
});

module.exports = { GET, POST };
