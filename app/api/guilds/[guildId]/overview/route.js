const { NextResponse } = require('next/server');
const { prisma } = require('../../../../../database/client');
const { guildRoute } = require('../../../../../lib/guildRoute');
const {
  bucketize,
  getRangeStart,
  parseRange,
} = require('../../../../../lib/analytics');
const { botFetch } = require('../../../../../lib/discordRest');

const GET = guildRoute(async ({ request, guildId }) => {
  const range = parseRange(new URL(request.url).searchParams.get('range'));
  const since = getRangeStart(range);
  const inRange = { guildId, createdAt: { gte: since } };

  const [
    guild,
    discordGuild,
    warnings,
    cases,
    openTickets,
    levelUsers,
    recentCases,
    caseDates,
    ticketDates,
    memberDates,
  ] = await Promise.all([
    prisma.guild.findUnique({ where: { id: guildId } }),
    botFetch(`/guilds/${guildId}?with_counts=true`).catch(() => null),
    prisma.warning.count({ where: { guildId } }),
    prisma.moderationCase.count({ where: { guildId } }),
    prisma.ticket.count({ where: { guildId, status: 'OPEN' } }),
    prisma.levelUser.count({ where: { guildId } }),
    prisma.moderationCase.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { target: { select: { username: true } } },
    }),
    prisma.moderationCase.findMany({
      where: inRange,
      select: { createdAt: true },
    }),
    prisma.ticket.findMany({ where: inRange, select: { createdAt: true } }),
    prisma.user.findMany({ where: inRange, select: { createdAt: true } }),
  ]);
  if (!guild) {
    return NextResponse.json({ error: 'Guild not found.' }, { status: 404 });
  }

  const toDates = (rows) => rows.map((row) => row.createdAt);
  return NextResponse.json({
    guild,
    range,
    stats: {
      members:
        discordGuild?.member_count ??
        discordGuild?.approximate_member_count ??
        'Unavailable',
      warnings,
      cases,
      openTickets,
      activeLevelUsers: levelUsers,
    },
    activity: [
      {
        key: 'members',
        label: 'New members',
        points: bucketize(toDates(memberDates), range),
      },
      {
        key: 'cases',
        label: 'Moderation',
        points: bucketize(toDates(caseDates), range),
      },
      {
        key: 'tickets',
        label: 'Tickets',
        points: bucketize(toDates(ticketDates), range),
      },
    ],
    recentCases: recentCases.map(({ target, ...item }) => ({
      ...item,
      targetName: target?.username ?? null,
    })),
  });
});

module.exports = { GET };
