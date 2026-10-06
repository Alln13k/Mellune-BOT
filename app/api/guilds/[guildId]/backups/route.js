const { prisma } = require('../../../../../database/client');
const { guildRoute } = require('../../../../../lib/guildRoute');
const { readBody, response, text } = require('../../../../../lib/featureApi');
const { captureSnapshot, restoreSnapshot } = require('../../../../../services/backups/backupService');

const GET = guildRoute(async ({ guildId }) => {
  const backups = await prisma.serverBackup.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      guildId: true,
      name: true,
      version: true,
      status: true,
      createdBy: true,
      summary: true,
      createdAt: true,
    },
  });
  return response({ backups });
});

const POST = guildRoute(async ({ request, guildId, session }) => {
  const body = await readBody(request);
  if (body.action === 'restore') {
    const backup = await prisma.serverBackup.findFirst({
      where: { id: Number(body.id), guildId },
    });
    if (!backup) return response({ error: 'Backup not found.' }, 404);
    const report = await restoreSnapshot(prisma, guildId, backup.snapshot);
    return response({ restored: true, report });
  }
  const snapshot = await captureSnapshot(prisma, guildId);
  const name = text(body.name, 120, `Mellune backup ${new Date().toISOString().slice(0, 10)}`);
  const backup = await prisma.serverBackup.create({
    data: {
      guildId,
      name,
      createdBy: session.user.id,
      snapshot,
      summary: {
        roles: snapshot.roles.length,
        channels: snapshot.channels.length,
        categories: snapshot.channels.filter((channel) => channel.type === 4).length,
        ticketPanels: snapshot.mellune.ticketPanels.length,
      },
    },
  });
  return response({ backup }, 201);
});

module.exports = { GET, POST };
