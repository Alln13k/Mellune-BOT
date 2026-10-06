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

const DEFAULTS = {
  enabled: false,
  channelId: null,
  roleId: null,
  title: 'Verify your membership',
  description: 'Click the button below to access the server.',
  buttonLabel: 'Verify',
  minAccountAgeHours: 0,
  messageId: null,
};

const GET = featureRoute(async ({ guildId }) => {
  const [config, resources] = await Promise.all([
    prisma.verificationConfig.findUnique({ where: { guildId } }),
    getResources(guildId),
  ]);
  return response({
    config: { ...DEFAULTS, ...config },
    channels: resources.channels.filter((channel) =>
      [0, 5].includes(channel.type),
    ),
    roles: resources.roles,
  });
});

const POST = featureRoute(async ({ request, guildId }) => {
  const body = await readBody(request);
  const data = {
    enabled: body.enabled === true,
    channelId: snowflake(body.channelId),
    roleId: snowflake(body.roleId),
    title: text(body.title, 100, DEFAULTS.title),
    description: text(body.description, 1000, DEFAULTS.description),
    buttonLabel: text(body.buttonLabel, 80, DEFAULTS.buttonLabel),
    minAccountAgeHours: Math.min(
      8760,
      Math.max(0, Number(body.minAccountAgeHours) || 0),
    ),
  };
  const config = await prisma.verificationConfig.upsert({
    where: { guildId },
    update: data,
    create: { guildId, ...data },
  });
  let jobId = null;
  if (body.publish && config.channelId) {
    const job = await queueJob(prisma, guildId, 'SEND_VERIFICATION_PANEL', {
      channelId: config.channelId,
      title: config.title,
      description: config.description,
      buttonLabel: config.buttonLabel,
    });
    jobId = job.id;
  }
  return response({ config, jobId }, 200);
});

module.exports = { GET, POST };
