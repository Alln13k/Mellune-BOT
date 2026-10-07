const { prisma } = require('../../../../../database/client');
const {
  featureRoute,
  getResources,
  queueJob,
  readBody,
  response,
  snowflake,
} = require('../../../../../lib/featureApi');

async function ensureVoicePresenceTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VoicePresenceConfig" (
      "id" SERIAL NOT NULL,
      "guildId" TEXT NOT NULL,
      "enabled" BOOLEAN NOT NULL DEFAULT false,
      "channelId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VoicePresenceConfig_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "VoicePresenceConfig_guildId_key" ON "VoicePresenceConfig"("guildId")`,
  );
}

const GET = featureRoute(async ({ guildId }) => {
  await ensureVoicePresenceTable();
  const [config, resources] = await Promise.all([
    prisma.voicePresenceConfig.findUnique({ where: { guildId } }),
    getResources(guildId),
  ]);
  return response({
    config: { enabled: false, channelId: null, ...config },
    channels: resources.channels.filter((channel) => channel.type === 2),
  });
});

const POST = featureRoute(async ({ request, guildId }) => {
  await ensureVoicePresenceTable();
  const body = await readBody(request);
  const channelId = snowflake(body.channelId);
  const resources = await getResources(guildId);
  if (body.enabled === true && !resources.channels.some(
    (channel) => channel.type === 2 && channel.id === channelId,
  )) {
    return response({ error: 'Choose a voice channel from this server.' }, 400);
  }
  const config = await prisma.voicePresenceConfig.upsert({
    where: { guildId },
    update: { enabled: body.enabled === true, channelId },
    create: { guildId, enabled: body.enabled === true, channelId },
  });
  await queueJob(prisma, guildId, 'SYNC_VOICE_PRESENCE', {
    enabled: config.enabled,
    channelId: config.channelId,
  });
  return response({ config });
});

module.exports = { GET, POST };
