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

function cleanButtons(buttons) {
  if (!Array.isArray(buttons)) return [];
  return buttons.slice(0, 5).map((button, index) => ({
    label: text(button.label, 80, `Button ${index + 1}`),
    style: ['PRIMARY', 'SECONDARY', 'SUCCESS', 'DANGER', 'LINK'].includes(
      button.style,
    )
      ? button.style
      : 'SECONDARY',
    actionType: ['REPLY', 'ROLE_ADD', 'ROLE_REMOVE', 'LINK'].includes(
      button.actionType,
    )
      ? button.actionType
      : 'REPLY',
    actionValue: text(button.actionValue, 500),
    url: button.style === 'LINK' ? text(button.url, 500) : null,
  }));
}

const GET = featureRoute(async ({ guildId }) => {
  const [interactions, resources] = await Promise.all([
    prisma.interactionDefinition.findMany({
      where: { guildId },
      orderBy: { updatedAt: 'desc' },
    }),
    getResources(guildId),
  ]);
  return response({
    interactions,
    channels: resources.channels.filter((channel) =>
      [0, 5].includes(channel.type),
    ),
    roles: resources.roles,
  });
});

const POST = featureRoute(async ({ request, guildId }) => {
  const body = await readBody(request);
  const name = text(body.name, 80, 'New interaction');
  const payload = {
    channelId: snowflake(body.channelId),
    content: text(body.content, 2000),
    embed: cleanEmbed(body.embed || {}),
    buttons: cleanButtons(body.buttons),
  };
  if (!payload.channelId) throw new Error('Choose a Discord channel.');
  const existing = body.id
    ? await prisma.interactionDefinition.findFirst({
        where: { id: Number(body.id), guildId },
      })
    : null;
  const definition = existing
    ? await prisma.interactionDefinition.update({
        where: { id: existing.id },
        data: {
          name,
          kind: 'BUTTONS',
          payload,
          enabled: body.enabled !== false,
        },
      })
    : await prisma.interactionDefinition.upsert({
        where: { guildId_name: { guildId, name } },
        update: { kind: 'BUTTONS', payload, enabled: body.enabled !== false },
        create: {
          guildId,
          name,
          kind: 'BUTTONS',
          payload,
          enabled: body.enabled !== false,
        },
      });
  let jobId = null;
  if (body.publish) {
    const job = await queueJob(prisma, guildId, 'SEND_INTERACTION_PANEL', {
      definitionId: definition.id,
      ...payload,
    });
    jobId = job.id;
  }
  return response({ interaction: definition, jobId });
});

module.exports = { GET, POST };
