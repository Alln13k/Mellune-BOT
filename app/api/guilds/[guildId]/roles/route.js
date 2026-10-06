const { prisma } = require('../../../../../database/client');
const { color } = require('../../../../../lib/validate');
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
    prisma.reactionRolePanel.findMany({
      where: { guildId },
      include: { entries: { orderBy: { id: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
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
    const rawEntries = Array.isArray(body.entries) ? body.entries : body.roles;
    const entries = Array.isArray(rawEntries)
      ? rawEntries
          .slice(0, 25)
          .map((role) => ({
            roleId: snowflake(role.roleId),
            label: text(role.label, 80, 'Role'),
            emoji: text(role.emoji, 16, '🔘'),
            description: text(role.description, 200) || null,
            mode: ['BUTTON', 'REACTION', 'SELECT'].includes(role.mode)
              ? role.mode
              : body.mode || 'BUTTON',
            exclusiveGroup: text(role.exclusiveGroup, 80) || null,
            enabled: role.enabled !== false,
          }))
          .filter((entry) => entry.roleId && entry.enabled)
      : [];
    if (!channelId || !entries.length)
      throw new Error('Choose a channel and at least one role option.');
    const panelData = {
      name: text(body.name, 80, 'Role menu'),
      channelId,
      mode: ['BUTTON', 'REACTION', 'SELECT'].includes(body.mode)
        ? body.mode
        : 'BUTTON',
      title: text(body.title, 256, 'Choose your roles'),
      description: text(
        body.description,
        4096,
        'Select the roles that apply to you.',
      ),
      color: color(body.color),
      authorName: text(body.authorName, 256) || null,
      authorIconUrl: text(body.authorIconUrl, 500) || null,
      thumbnailUrl: text(body.thumbnailUrl, 500) || null,
      imageUrl: text(body.imageUrl, 500) || null,
      footer: text(body.footer, 2048) || null,
      footerIconUrl: text(body.footerIconUrl, 500) || null,
      useTimestamp: body.useTimestamp === true,
      exclusiveMode: body.exclusiveMode === 'EXCLUSIVE' ? 'EXCLUSIVE' : 'MULTIPLE',
      enabled: body.enabled !== false,
    };
    const panel = await prisma.$transaction(async (transaction) => {
      const existing = body.panelId
        ? await transaction.reactionRolePanel.findFirst({
            where: { id: Number(body.panelId), guildId },
          })
        : null;
      const saved = existing
        ? await transaction.reactionRolePanel.update({
            where: { id: existing.id },
            data: panelData,
          })
        : await transaction.reactionRolePanel.create({
            data: { guildId, ...panelData },
          });
      await transaction.reactionRole.deleteMany({ where: { panelId: saved.id } });
      await transaction.reactionRole.createMany({
        data: entries.map((entry) => ({
          guildId,
          panelId: saved.id,
          channelId,
          messageId: null,
          ...entry,
        })),
      });
      return transaction.reactionRolePanel.findUnique({
        where: { id: saved.id },
        include: { entries: true },
      });
    });
    const job = await queueJob(prisma, guildId, 'SEND_REACTION_ROLE_PANEL', {
      panelId: panel.id,
    });
    return response({ panel, queued: true, jobId: job.id }, 202);
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
    if (body.panelId) {
      await prisma.reactionRolePanel.deleteMany({
        where: { id: Number(body.panelId), guildId },
      });
    } else {
      await prisma.reactionRole.deleteMany({
        where: { guildId, messageId: text(body.messageId, 32) },
      });
    }
    return response({ ok: true });
  }
  throw new Error('Unsupported role action.');
});

module.exports = { GET, POST };
