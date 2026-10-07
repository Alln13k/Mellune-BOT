const { prisma } = require('../../../../../database/client');
const {
  featureRoute,
  getResources,
  readBody,
  response,
  snowflake,
} = require('../../../../../lib/featureApi');

const GET = featureRoute(async ({ guildId }) => {
  const [config, resources] = await Promise.all([
    prisma.voicePresenceConfig.findUnique({ where: { guildId } }),
    getResources(guildId),
  ]);
  return response({
    config: { enabled: false, channelId: null, ...config },
    channels: resources.channels.filter((channel) => channel.type === 2),
  });
});

const POST = featureRoute(async ({ request, guildId }) => {
  const body = await readBody(request);
  const channelId = snowflake(body.channelId);
  const resources = await getResources(guildId);
  if (body.enabled === true && !resources.channels.some(
    (channel) => channel.type === 2 && channel.id === channelId,
  )) {
    return response({ error: 'Choose a voice channel from this server.' }, 400);
  }
  const config = await prisma.voicePresenceConfig.upsert({
    where: { guildId },
    update: { enabled: body.enabled === true, channelId },
    create: { guildId, enabled: body.enabled === true, channelId },
  });
  return response({ config });
});

module.exports = { GET, POST };
