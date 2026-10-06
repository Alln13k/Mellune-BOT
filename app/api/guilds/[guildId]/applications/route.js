const { prisma } = require('../../../../../database/client');
const {
  featureRoute,
  getResources,
  readBody,
  response,
  snowflake,
  text,
  cleanQuestion,
} = require('../../../../../lib/featureApi');

const GET = featureRoute(async ({ guildId }) => {
  const [forms, resources] = await Promise.all([
    prisma.applicationForm.findMany({
      where: { guildId },
      orderBy: { createdAt: 'asc' },
      include: {
        questions: { orderBy: { position: 'asc' } },
        submissions: {
          orderBy: { createdAt: 'desc' },
          take: 25,
          include: { answers: true },
        },
      },
    }),
    getResources(guildId),
  ]);
  return response({
    forms,
    channels: resources.channels.filter((channel) =>
      [0, 5].includes(channel.type),
    ),
    roles: resources.roles,
  });
});

const POST = featureRoute(async ({ request, guildId }) => {
  const body = await readBody(request);
  const data = {
    title: text(body.title, 100, 'New application'),
    description: text(body.description, 1000, 'Answer the questions below.'),
    destinationChannelId: snowflake(body.destinationChannelId),
    reviewRoleId: snowflake(body.reviewRoleId),
    enabled: body.enabled === true,
  };
  const questions = Array.isArray(body.questions)
    ? body.questions.slice(0, 5).map(cleanQuestion)
    : [];
  const existing = body.id
    ? await prisma.applicationForm.findFirst({
        where: { id: Number(body.id), guildId },
      })
    : null;
  const form = existing
    ? await prisma.applicationForm.update({
        where: { id: existing.id },
        data: {
          ...data,
          questions: {
            deleteMany: {},
            create: questions,
          },
        },
        include: { questions: { orderBy: { position: 'asc' } } },
      })
    : await prisma.applicationForm.create({
        data: {
          guildId,
          ...data,
          questions: { create: questions },
        },
        include: { questions: { orderBy: { position: 'asc' } } },
      });
  return response({ form });
});

module.exports = { GET, POST };
