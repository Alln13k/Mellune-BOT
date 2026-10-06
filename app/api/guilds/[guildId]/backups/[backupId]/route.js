const { prisma } = require('../../../../../../database/client');
const { guildRoute } = require('../../../../../../lib/guildRoute');
const { response } = require('../../../../../../lib/featureApi');

const GET = guildRoute(async ({ guildId, params }) => {
  const backup = await prisma.serverBackup.findFirst({
    where: { id: Number(params.backupId), guildId },
  });
  return backup
    ? response({ backup })
    : response({ error: 'Backup not found.' }, 404);
});

const DELETE = guildRoute(async ({ guildId, params }) => {
  const result = await prisma.serverBackup.deleteMany({
    where: { id: Number(params.backupId), guildId },
  });
  return result.count
    ? response({ deleted: true })
    : response({ error: 'Backup not found.' }, 404);
});

module.exports = { DELETE, GET };
