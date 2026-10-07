const { prisma } = require('../../../../../database/client');
const {
  featureRoute,
  readBody,
  response,
  snowflake,
} = require('../../../../../lib/featureApi');

const DEFAULTS = {
  enabled: false,
  joinThreshold: 5,
  windowSeconds: 10,
  minAccountAgeHours: 24,
  suspiciousOnly: true,
  action: 'ALERT',
  logChannelId: null,
};

const GET = featureRoute(async ({ guildId }) => {
  const config = await prisma.raidProtectionConfig.findUnique({
    where: { guildId },
  });
  return response({ config: { ...DEFAULTS, ...config } });
});

const POST = featureRoute(async ({ request, guildId }) => {
  const body = await readBody(request);
  const data = {
    enabled: body.enabled === true,
    joinThreshold: Math.min(100, Math.max(2, Number(body.joinThreshold) || 5)),
    windowSeconds: Math.min(
      3600,
      Math.max(2, Number(body.windowSeconds) || 10),
    ),
    minAccountAgeHours: Math.min(
      8760,
      Math.max(0, Number(body.minAccountAgeHours) || 0),
    ),
    suspiciousOnly: body.suspiciousOnly !== false,
    action: ['ALERT', 'TIMEOUT', 'KICK'].includes(body.action)
      ? body.action
      : 'ALERT',
    logChannelId: snowflake(body.logChannelId),
  };
  const config = await prisma.raidProtectionConfig.upsert({
    where: { guildId },
    update: data,
    create: { guildId, ...data },
  });
  return response({ config });
});

module.exports = { GET, POST };
