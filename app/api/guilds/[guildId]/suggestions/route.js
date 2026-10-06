const { prisma } = require('../../../../../database/client');
const {
  featureRoute,
  getResources,
  readBody,
  response,
  snowflake,
  text,
} = require('../../../../../lib/featureApi');

const GET = featureRoute(async ({ guildId }) => {
  const [settings, suggestions, resources] = await Promise.all([
    prisma.guildSettings.findUnique({ where: { guildId } }),
    prisma.suggestion.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    getResources(guildId),
  ]);
  return response({
    settings: {
      enabled: settings?.suggestionEnabled || false,
      channelId: settings?.suggestionChannelId || null,
      staffRoleId: settings?.suggestionStaffRoleId || null,
    },
    suggestions,
    channels: resources.channels.filter((channel) =>
      [0, 5].includes(channel.type),
    ),
    roles: resources.roles,
  });
});

const POST = featureRoute(async ({ request, guildId, session }) => {
  const body = await readBody(request);
  if (body.action === 'review') {
    const id = Number(body.id);
    const status = ['PENDING', 'APPROVED', 'REJECTED', 'IMPLEMENTED'].includes(
      body.status,
    )
      ? body.status
      : null;
    if (!status) throw new Error('Invalid suggestion status.');
    const suggestion = await prisma.suggestion.updateMany({
      where: { id, guildId },
      data: {
        status,
        reviewerId: session.user.id,
        response: text(body.response, 1000) || null,
      },
    });
    return response({ updated: suggestion.count });
  }
  const data = {
    suggestionEnabled: body.enabled === true,
    suggestionChannelId: snowflake(body.channelId),
    suggestionStaffRoleId: snowflake(body.staffRoleId),
  };
  const settings = await prisma.guildSettings.upsert({
    where: { guildId },
    update: data,
    create: { guildId, ...data },
  });
  return response({ settings });
});

module.exports = { GET, POST };
