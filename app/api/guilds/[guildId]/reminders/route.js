const { prisma } = require('../../../../../database/client');
const {
  featureRoute,
  getResources,
  readBody,
  response,
  snowflake,
  text,
} = require('../../../../../lib/featureApi');

const GET = featureRoute(async ({ guildId, session }) => {
  const [reminders, resources] = await Promise.all([
    prisma.reminder.findMany({
      where: { guildId, userId: session.user.id, status: 'PENDING' },
      orderBy: { dueAt: 'asc' },
    }),
    getResources(guildId),
  ]);
  return response({
    reminders,
    channels: resources.channels.filter((channel) =>
      [0, 5].includes(channel.type),
    ),
  });
});

const POST = featureRoute(async ({ request, guildId, session }) => {
  const body = await readBody(request);
  const dueAt = new Date(body.dueAt);
  if (Number.isNaN(dueAt.getTime()) || dueAt <= new Date()) {
    throw new Error('Reminder time must be in the future.');
  }
  const reminder = await prisma.reminder.create({
    data: {
      guildId,
      userId: snowflake(body.userId) || session.user.id,
      channelId: snowflake(body.channelId),
      message: text(body.message, 2000, 'Reminder'),
      dueAt,
      recurrence: ['hourly', 'daily', 'weekly', 'monthly'].includes(
        body.recurrence,
      )
        ? body.recurrence
        : null,
    },
  });
  return response({ reminder }, 201);
});

const DELETE = featureRoute(async ({ request, guildId, session }) => {
  const body = await readBody(request);
  const id = Number(body.id);
  const result = await prisma.reminder.deleteMany({
    where: { id, guildId, userId: session.user.id, status: 'PENDING' },
  });
  return response({ deleted: result.count });
});

module.exports = { GET, POST, DELETE };
