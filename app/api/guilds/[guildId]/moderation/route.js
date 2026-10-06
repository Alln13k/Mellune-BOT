const { NextResponse } = require('next/server');
const { prisma } = require('../../../../../database/client');
const { guildRoute } = require('../../../../../lib/guildRoute');

const PAGE_SIZE = 12;

const GET = guildRoute(async ({ request, guildId }) => {
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);
  const action = (params.get('action') || '').slice(0, 24).toUpperCase();
  const query = (params.get('q') || '').trim().slice(0, 64);

  const where = {
    guildId,
    ...(action ? { action } : {}),
    ...(query
      ? {
          OR: [
            { reason: { contains: query, mode: 'insensitive' } },
            { targetId: { contains: query } },
            {
              target: {
                username: { contains: query, mode: 'insensitive' },
              },
            },
          ],
        }
      : {}),
  };

  const [total, items, byAction] = await Promise.all([
    prisma.moderationCase.count({ where }),
    prisma.moderationCase.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { target: { select: { username: true } } },
    }),
    prisma.moderationCase.groupBy({
      by: ['action'],
      where: { guildId },
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    page,
    pageSize: PAGE_SIZE,
    total,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    actions: byAction.map((row) => ({
      action: row.action,
      count: row._count._all,
    })),
    cases: items.map(({ target, ...item }) => ({
      ...item,
      targetName: target?.username ?? null,
    })),
  });
});

module.exports = { GET };
