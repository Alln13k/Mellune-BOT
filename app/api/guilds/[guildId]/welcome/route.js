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
  title: 'Welcome to {server}',
  description: 'Welcome {user}! You are member #{memberCount}.',
  color: '#b9a7ff',
  footer: null,
  thumbnailUrl: null,
  imageUrl: null,
  useTimestamp: true,
  authorName: 'Mellune',
  authorIconUrl: null,
  mentionMode: 'USER',
  dmEnabled: false,
  autoRoleId: null,
};

const GET = featureRoute(async ({ guildId }) => {
  const [configs, resources] = await Promise.all([
    prisma.greetingConfig.findMany({ where: { guildId } }),
    getResources(guildId),
  ]);
  const byKind = new Map(configs.map((config) => [config.kind, config]));
  return response({
    welcome: { ...DEFAULTS, ...byKind.get('WELCOME') },
    goodbye: {
      ...DEFAULTS,
      title: '{username} left {server}',
      description: '{username} has left the server.',
      ...byKind.get('GOODBYE'),
    },
    channels: resources.channels.filter((channel) =>
      [0, 5].includes(channel.type),
    ),
    roles: resources.roles,
  });
});

const POST = featureRoute(async ({ request, guildId, session }) => {
  const body = await readBody(request);
  const kind = body.kind === 'GOODBYE' ? 'GOODBYE' : 'WELCOME';
  const data = {
    enabled: body.enabled === true,
    channelId: snowflake(body.channelId),
    title: text(body.title, 256, DEFAULTS.title),
    description: text(body.description, 4096, DEFAULTS.description),
    color: body.color || '#b9a7ff',
    footer: text(body.footer, 2048) || null,
    thumbnailUrl: body.thumbnailUrl
      ? String(body.thumbnailUrl).slice(0, 500)
      : null,
    imageUrl: body.imageUrl ? String(body.imageUrl).slice(0, 500) : null,
    useTimestamp: body.useTimestamp !== false,
    authorName: text(body.authorName, 256) || null,
    authorIconUrl: body.authorIconUrl
      ? String(body.authorIconUrl).slice(0, 500)
      : null,
    mentionMode: ['NONE', 'USER', 'EVERYONE'].includes(body.mentionMode)
      ? body.mentionMode
      : 'USER',
    dmEnabled: kind === 'WELCOME' && body.dmEnabled === true,
    autoRoleId: snowflake(body.autoRoleId),
  };
  const config = await prisma.greetingConfig.upsert({
    where: { guildId_kind: { guildId, kind } },
    update: data,
    create: { guildId, kind, ...data },
  });
  let jobId = null;
  if (body.test) {
    const job = await queueJob(prisma, guildId, 'TEST_GREETING', {
      userId: session.user.id,
      kind,
    });
    jobId = job.id;
  }
  return response({ config, jobId });
});

module.exports = { GET, POST };
