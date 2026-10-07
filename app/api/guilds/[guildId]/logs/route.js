const { prisma } = require('../../../../../database/client');
const {
  featureRoute,
  getResources,
  readBody,
  response,
  snowflake,
} = require('../../../../../lib/featureApi');

const DEFAULT_EVENTS = {
  memberJoin: true,
  memberLeave: true,
  messageDelete: true,
  messageEdit: true,
  moderation: true,
  roleChange: true,
  channelChange: true,
  ticket: true,
  configuration: true,
  automod: true,
  raid: true,
};

const GET = featureRoute(async ({ guildId }) => {
  const [config, resources] = await Promise.all([
    prisma.logConfig.findUnique({ where: { guildId } }),
    getResources(guildId),
  ]);
  return response({
    config: {
      enabled: true,
      memberLogId: null,
      messageLogId: null,
      moderationLogId: null,
      events: DEFAULT_EVENTS,
      ...config,
    },
    channels: resources.channels.filter((channel) =>
      [0, 5].includes(channel.type),
    ),
  });
});

const POST = featureRoute(async ({ request, guildId }) => {
  const body = await readBody(request);
  const events = Object.fromEntries(
    Object.entries(DEFAULT_EVENTS).map(([key, value]) => [
      key,
      typeof body.events?.[key] === 'boolean' ? body.events[key] : value,
    ]),
  );
  const data = {
    enabled: body.enabled !== false,
    memberLogId: snowflake(body.memberLogId),
    messageLogId: snowflake(body.messageLogId),
    moderationLogId: snowflake(body.moderationLogId),
    events,
  };
  const config = await prisma.logConfig.upsert({
    where: { guildId },
    update: data,
    create: { guildId, ...data },
  });
  return response({ config });
});

module.exports = { GET, POST };
