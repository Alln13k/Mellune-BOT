const { NextResponse } = require('next/server');
const { prisma } = require('../../../../../database/client');
const { requireGuildAccess } = require('../../../../../lib/apiAuth');

async function GET(request, { params }) {
  const { guildId } = await params;
  const authorization = await requireGuildAccess(request, guildId);
  if (authorization.error) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }

  try {
    const [guild, members, warnings, cases, tickets, levelUsers, recentCases] =
      await Promise.all([
        prisma.guild.findUnique({ where: { id: guildId } }),
        prisma.user.count({ where: { guildId } }),
        prisma.warning.count({ where: { guildId } }),
        prisma.moderationCase.count({ where: { guildId } }),
        prisma.ticket.count({ where: { guildId, status: 'OPEN' } }),
        prisma.levelUser.count({ where: { guildId } }),
        prisma.moderationCase.findMany({
          where: { guildId },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
      ]);
    if (!guild) {
      return NextResponse.json({ error: 'Guild not found.' }, { status: 404 });
    }
    return NextResponse.json({
      guild,
      stats: {
        members,
        warnings,
        cases,
        openTickets: tickets,
        activeLevelUsers: levelUsers,
      },
      recentCases,
    });
  } catch (error) {
    console.error('Dashboard overview failed:', error.message);
    return NextResponse.json(
      { error: 'Could not load overview.' },
      { status: 500 },
    );
  }
}

module.exports = { GET };
