const { prisma } = require('../../../../../database/client');
const {
  cleanEmbed,
  featureRoute,
  getResources,
  queueJob,
  readBody,
  response,
  snowflake,
  text,
} = require('../../../../../lib/featureApi');

const GET = featureRoute(async ({ guildId }) => {
  const [announcements, resources] = await Promise.all([
    prisma.announcement.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    getResources(guildId),
  ]);
  return response({
    announcements,
    channels: resources.channels.filter((channel) =>
      [0, 5].includes(channel.type),
    ),
    roles: resources.roles,
  });
});

const POST = featureRoute(async ({ request, guildId, session }) => {
  const body = await readBody(request);
  const channelId = snowflake(body.channelId);
  if (!channelId) throw new Error('Choose a Discord channel.');
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (
    scheduledAt &&
    (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date())
  ) {
    throw new Error('Scheduled time must be in the future.');
  }
  const data = {
    channelId,
    content: text(body.content, 2000),
    payload: body.payload ? cleanEmbed(body.payload) : null,
    scheduledAt,
    status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
    allowEveryone: body.allowEveryone === true,
    allowHere: body.allowHere === true,
    roleId: snowflake(body.roleId),
    createdBy: session.user.id,
  };
  const existing = body.id
    ? await prisma.announcement.findFirst({
        where: { id: Number(body.id), guildId },
      })
    : null;
  const announcement = existing
    ? await prisma.announcement.update({ where: { id: existing.id }, data })
    : await prisma.announcement.create({ data: { guildId, ...data } });

  if (body.action === 'send') {
    await prisma.announcement.update({
      where: { id: announcement.id },
      data: { status: 'QUEUED', scheduledAt: null },
    });
    const job = await queueJob(prisma, guildId, 'SEND_ANNOUNCEMENT', {
      announcementId: announcement.id,
      channelId,
      content: data.content,
      embed: data.payload,
      allowedMentions: {
        parse: data.allowEveryone || data.allowHere ? ['everyone'] : [],
        users: [],
        roles: data.roleId ? [data.roleId] : [],
      },
    });
    return response({ announcement, queued: true, jobId: job.id }, 202);
  }
  return response({ announcement });
});

module.exports = { GET, POST };
