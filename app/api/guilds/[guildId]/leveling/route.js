const { NextResponse } = require('next/server');
const { prisma } = require('../../../../../database/client');
const { guildRoute, badRequest } = require('../../../../../lib/guildRoute');

const GET = guildRoute(async ({ guildId }) => {
  const [settings, top, total] = await Promise.all([
    prisma.guildSettings.findUnique({ where: { guildId } }),
    prisma.levelUser.findMany({
      where: { guildId },
      orderBy: { xp: 'desc' },
      take: 10,
    }),
    prisma.levelUser.count({ where: { guildId } }),
  ]);
  const users = await prisma.user.findMany({
    where: { guildId, userId: { in: top.map((entry) => entry.userId) } },
    select: { userId: true, username: true },
  });
  const names = new Map(users.map((user) => [user.userId, user.username]));
  return NextResponse.json({
    enabled: Boolean(settings?.xpEnabled),
    total,
    leaderboard: top.map((entry) => ({
      userId: entry.userId,
      username: names.get(entry.userId) ?? null,
      xp: entry.xp,
      level: entry.level,
      messages: entry.messages,
    })),
  });
});

const POST = guildRoute(async ({ request, guildId }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body.');
  }
  if (typeof body.enabled !== 'boolean') {
    return badRequest('"enabled" must be true or false.');
  }
  const settings = await prisma.guildSettings.upsert({
    where: { guildId },
    update: { xpEnabled: body.enabled },
    create: { guildId, xpEnabled: body.enabled },
  });
  return NextResponse.json({ enabled: settings.xpEnabled });
});

module.exports = { GET, POST };
