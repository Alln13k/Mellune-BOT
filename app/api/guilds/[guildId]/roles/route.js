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
  const [resources, panels] = await Promise.all([
    getResources(guildId),
    prisma.reactionRole.findMany({ where: { guildId } }),
  ]);
  return response({
    roles: resources.roles,
    channels: resources.channels.filter((channel) =>
      [0, 5].includes(channel.type),
    ),
    panels,
    botRole: resources.roles.sort((a, b) => b.position - a.position)[0] || null,
  });
});

const POST = featureRoute(async ({ request, guildId }) => {
  const body = await readBody(request);
  const action = body.action;
  if (action === 'create') {
    const job = await queueJob(prisma, guildId, 'CREATE_ROLE', {
      name: text(body.name, 100, 'New role'),
      color: body.color || '#99aab5',
      hoist: body.hoist === true,
      mentionable: body.mentionable === true,
      requestedBy: body.requestedBy,
    });
    return response({ queued: true, jobId: job.id }, 202);
  }
  if (action === 'panel') {
    const channelId = snowflake(body.channelId);
    const roles = Array.isArray(body.roles)
      ? body.roles
          .slice(0, 5)
          .map((role) => ({
            roleId: snowflake(role.roleId),
            label: text(role.label, 80, 'Role'),
          }))
          .filter((role) => role.roleId)
      : [];
    if (!channelId || !roles.length)
      throw new Error('Choose a channel and at least one role.');
    const job = await queueJob(prisma, guildId, 'SEND_ROLE_PANEL', {
      channelId,
      title: text(body.title, 100, 'Choose your roles'),
      description: text(
        body.description,
        1000,
        'Select a button to update your roles.',
      ),
      roles,
    });
    return response({ queued: true, jobId: job.id }, 202);
  }
  if (action === 'edit' || action === 'assign' || action === 'remove') {
    const roleId = snowflake(body.roleId);
    if (!roleId) throw new Error('A valid role id is required.');
    const userId = action === 'edit' ? null : snowflake(body.userId);
    if (action !== 'edit' && !userId)
      throw new Error('A valid user id is required.');
    const job = await queueJob(
      prisma,
      guildId,
      action === 'edit'
        ? 'EDIT_ROLE'
        : action === 'assign'
          ? 'ROLE_ASSIGN'
          : 'ROLE_REMOVE',
      {
        roleId,
        userId,
        name: text(body.name, 100),
        color: body.color,
        hoist: body.hoist === true,
        mentionable: body.mentionable === true,
      },
    );
    return response({ queued: true, jobId: job.id }, 202);
  }
  if (action === 'delete-panel') {
    await prisma.reactionRole.deleteMany({
      where: { guildId, messageId: text(body.messageId, 32) },
    });
    return response({ ok: true });
  }
  throw new Error('Unsupported role action.');
});

module.exports = { GET, POST };
