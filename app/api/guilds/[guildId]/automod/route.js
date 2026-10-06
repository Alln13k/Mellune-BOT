const { prisma } = require('../../../../../database/client');
const {
  featureRoute,
  readBody,
  response,
} = require('../../../../../lib/featureApi');

const DEFAULT_TYPES = [
  'SPAM',
  'REPEATED',
  'MENTIONS',
  'MASS_MENTIONS',
  'EMOJIS',
  'LINKS',
  'INVITES',
  'WORDS',
  'DOMAINS',
  'CAPS',
];

const GET = featureRoute(async ({ guildId }) => {
  const rules = await prisma.autoModRule.findMany({
    where: { guildId },
    orderBy: { type: 'asc' },
  });
  const byType = new Map(rules.map((rule) => [rule.type, rule]));
  return response({
    rules: DEFAULT_TYPES.map(
      (type) =>
        byType.get(type) || {
          id: null,
          guildId,
          type,
          enabled: false,
          action: 'DELETE',
          value: null,
          threshold: 5,
          windowSeconds: 10,
          patterns: [],
          logEnabled: true,
        },
    ),
  });
});

const POST = featureRoute(async ({ request, guildId }) => {
  const body = await readBody(request);
  if (!Array.isArray(body.rules)) throw new Error('Rules must be an array.');
  const rules = body.rules.slice(0, DEFAULT_TYPES.length);
  const saved = [];
  for (const input of rules) {
    if (!DEFAULT_TYPES.includes(input.type)) continue;
    const action = ['DELETE', 'WARN', 'TIMEOUT', 'KICK', 'BAN'].includes(
      input.action,
    )
      ? input.action
      : 'DELETE';
    const data = {
      enabled: input.enabled === true,
      action,
      value:
        typeof input.value === 'string'
          ? input.value.trim().slice(0, 2000)
          : null,
      threshold: Math.min(100, Math.max(1, Number(input.threshold) || 5)),
      windowSeconds: Math.min(
        3600,
        Math.max(1, Number(input.windowSeconds) || 10),
      ),
      patterns: Array.isArray(input.patterns)
        ? input.patterns
            .filter((item) => typeof item === 'string')
            .slice(0, 100)
        : [],
      logEnabled: input.logEnabled !== false,
    };
    saved.push(
      await prisma.autoModRule.upsert({
        where: { guildId_type: { guildId, type: input.type } },
        update: data,
        create: { guildId, type: input.type, ...data },
      }),
    );
  }
  return response({ rules: saved });
});

module.exports = { GET, POST };
