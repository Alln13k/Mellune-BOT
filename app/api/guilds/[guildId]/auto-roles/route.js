const { prisma } = require('../../../../../database/client');
const { botFetch, guildResources } = require('../../../../../lib/discordRest');
const {
  featureRoute,
  readBody,
  response,
  snowflake,
} = require('../../../../../lib/featureApi');

async function roleStatus(guildId, roles) {
  const me = await botFetch(`/users/@me`);
  const member = await botFetch(`/guilds/${guildId}/members/${me.id}`);
  const highest = Math.max(
    0,
    ...roles
      .filter((role) => member.roles.includes(role.id))
      .map((role) => role.position),
  );
  return roles.map((role) => ({
    ...role,
    assignable: !role.managed && role.id !== guildId && role.position < highest,
    reason: role.managed
      ? 'Managed roles cannot be assigned.'
      : role.id === guildId
        ? '@everyone cannot be assigned.'
        : role.position >= highest
          ? 'This role is at or above Mellune’s highest role.'
          : null,
  }));
}

const GET = featureRoute(async ({ guildId }) => {
  const [config, resources] = await Promise.all([
    prisma.autoRoleConfig.findUnique({ where: { guildId } }),
    guildResources(guildId),
  ]);
  const roles = await roleStatus(guildId, resources.roles);
  return response({
    config: config || { enabled: false, roleIds: [], ignoreBots: true },
    roles,
  });
});

const POST = featureRoute(async ({ request, guildId }) => {
  const body = await readBody(request);
  const roleIds = Array.isArray(body.roleIds)
    ? body.roleIds.map(snowflake).filter(Boolean).slice(0, 20)
    : [];
  const resources = await guildResources(guildId);
  const statuses = await roleStatus(guildId, resources.roles);
  const invalid = statuses.filter(
    (role) => roleIds.includes(role.id) && !role.assignable,
  );
  const knownIds = new Set(statuses.map((role) => role.id));
  for (const roleId of roleIds) {
    if (!knownIds.has(roleId)) {
      invalid.push({
        id: roleId,
        name: roleId,
        reason: 'This role no longer exists.',
      });
    }
  }
  if (invalid.length) {
    return response({
      error: invalid.map((role) => `${role.name}: ${role.reason}`).join(' '),
      invalid,
    }, 400);
  }
  const config = await prisma.autoRoleConfig.upsert({
    where: { guildId },
    update: {
      enabled: body.enabled === true,
      roleIds,
      ignoreBots: body.ignoreBots !== false,
    },
    create: {
      guildId,
      enabled: body.enabled === true,
      roleIds,
      ignoreBots: body.ignoreBots !== false,
    },
  });
  return response({ config, roles: statuses });
});

module.exports = { GET, POST };
