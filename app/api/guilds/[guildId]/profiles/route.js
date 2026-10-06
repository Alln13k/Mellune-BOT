const { prisma } = require('../../../../../database/client');
const { guildRoute } = require('../../../../../lib/guildRoute');
const { response } = require('../../../../../lib/featureApi');

const GET = guildRoute(async ({ request, guildId }) => {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize')) || 25));
  const search = (url.searchParams.get('search') || '').trim().slice(0, 100);
  const where = {
    guildId,
    ...(search
      ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { userId: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  const levels = await prisma.levelUser.findMany({
    where: { guildId, userId: { in: users.map((user) => user.userId) } },
  });
  const levelMap = new Map(levels.map((level) => [level.userId, level]));
  return response({
    profiles: users.map((user) => ({
      ...user,
      level: levelMap.get(user.userId)?.level || 0,
      xp: levelMap.get(user.userId)?.xp || 0,
      messages: levelMap.get(user.userId)?.messages || 0,
    })),
    pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
  });
});

module.exports = { GET };
