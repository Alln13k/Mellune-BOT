const { prisma } = require('../../../../../database/client');
const {
  cleanEmbed,
  cleanMentions,
  featureRoute,
  getResources,
  queueJob,
  readBody,
  response,
  snowflake,
  text,
} = require('../../../../../lib/featureApi');

const GET = featureRoute(async ({ guildId }) => {
  const [embeds, resources] = await Promise.all([
    prisma.embedDefinition.findMany({
      where: { guildId },
      orderBy: { updatedAt: 'desc' },
    }),
    getResources(guildId),
  ]);
  return response({
    embeds,
    channels: resources.channels.filter((channel) =>
      [0, 5].includes(channel.type),
    ),
  });
});

const POST = featureRoute(async ({ request, guildId }) => {
  const body = await readBody(request);
  const payload = cleanEmbed(body.payload || body);
  if (body.action === 'send') {
    const channelId = snowflake(body.channelId);
    if (!channelId) throw new Error('Choose a Discord channel.');
    const job = await queueJob(prisma, guildId, 'SEND_EMBED', {
      channelId,
      content: text(body.content, 2000),
      embed: payload,
      allowedMentions: cleanMentions(body.allowedMentions),
    });
    return response({ queued: true, jobId: job.id }, 202);
  }
  const name = text(body.name, 80, 'Untitled embed');
  const existing = body.id
    ? await prisma.embedDefinition.findFirst({
        where: { id: Number(body.id), guildId },
      })
    : null;
  const embed = existing
    ? await prisma.embedDefinition.update({
        where: { id: existing.id },
        data: { name, payload },
      })
    : await prisma.embedDefinition.upsert({
        where: { guildId_name: { guildId, name } },
        update: { payload },
        create: { guildId, name, payload },
      });
  return response({ embed });
});

module.exports = { GET, POST };
