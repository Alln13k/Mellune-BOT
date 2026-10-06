const { prisma } = require('../../../../../database/client');
const {
  featureRoute,
  getResources,
  queueJob,
  readBody,
  response,
  snowflake,
  text,
} = require('../../../../../lib/featureApi');

const GET = featureRoute(async ({ guildId }) => {
  const [giveaways, resources] = await Promise.all([
    prisma.giveaway.findMany({
      where: { guildId },
      include: { _count: { select: { entries: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    getResources(guildId),
  ]);
  return response({
    giveaways,
    channels: resources.channels.filter((channel) =>
      [0, 5].includes(channel.type),
    ),
    roles: resources.roles,
  });
});

const POST = featureRoute(async ({ request, guildId, session }) => {
  const body = await readBody(request);
  const action = body.action || 'start';
  if (action === 'reroll') {
    const giveaway = await prisma.giveaway.findFirst({
      where: { id: Number(body.id), guildId, status: 'ENDED' },
    });
    if (!giveaway) throw new Error('Ended giveaway not found.');
    const job = await queueJob(prisma, guildId, 'REROLL_GIVEAWAY', {
      giveawayId: giveaway.id,
    });
    return response({ queued: true, jobId: job.id }, 202);
  }
  const channelId = snowflake(body.channelId);
  const endsAt = new Date(body.endsAt);
  if (!channelId) throw new Error('Choose a Discord channel.');
  if (Number.isNaN(endsAt.getTime()) || endsAt <= new Date()) {
    throw new Error('Giveaway end time must be in the future.');
  }
  const giveaway = await prisma.giveaway.create({
    data: {
      guildId,
      channelId,
      prize: text(body.prize, 200, 'Mellune giveaway'),
      winners: Math.min(20, Math.max(1, Number(body.winners) || 1)),
      endsAt,
      requiredRoleId: snowflake(body.requiredRoleId),
      entryRequirements: body.entryRequirements || null,
      startedBy: session.user.id,
      status: 'QUEUED',
    },
  });
  const job = await queueJob(prisma, guildId, 'START_GIVEAWAY', {
    giveawayId: giveaway.id,
  });
  return response({ giveaway, queued: true, jobId: job.id }, 201);
});

module.exports = { GET, POST };
