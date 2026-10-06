const { NextResponse } = require('next/server');
const { prisma } = require('../../../../../database/client');
const { guildRoute, badRequest } = require('../../../../../lib/guildRoute');
const {
  bool,
  nullableText,
  snowflake,
} = require('../../../../../lib/validate');

const DEFAULTS = {
  channelId: null,
  welcomeText: 'Welcome to {server}, {user}! You are member #{memberCount}.',
  leaveText: '{username} just left {server}.',
  dmEnabled: false,
  autoRoleId: null,
  enabled: false,
};

const GET = guildRoute(async ({ guildId }) => {
  const config = await prisma.welcomeConfig.findUnique({ where: { guildId } });
  return NextResponse.json({
    config: config ? { ...DEFAULTS, ...config } : DEFAULTS,
  });
});

const POST = guildRoute(async ({ request, guildId }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body.');
  }
  if (body.channelId && !snowflake(body.channelId)) {
    return badRequest('The channel id must be a valid Discord id.');
  }
  if (body.autoRoleId && !snowflake(body.autoRoleId)) {
    return badRequest('The role id must be a valid Discord id.');
  }
  const data = {
    channelId: snowflake(body.channelId),
    welcomeText: nullableText(body.welcomeText, 1500),
    leaveText: nullableText(body.leaveText, 1500),
    dmEnabled: bool(body.dmEnabled),
    autoRoleId: snowflake(body.autoRoleId),
    enabled: bool(body.enabled),
  };
  const config = await prisma.welcomeConfig.upsert({
    where: { guildId },
    update: data,
    create: { guildId, ...data },
  });
  return NextResponse.json({ config });
});

module.exports = { GET, POST };
