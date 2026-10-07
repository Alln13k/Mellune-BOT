const { NextResponse } = require('next/server');
const { prisma } = require('../../../../../database/client');
const { guildRoute } = require('../../../../../lib/guildRoute');
const { botFetch } = require('../../../../../lib/discordRest');

const PAGE_SIZE = 12;
const MEMBER_BATCH_SIZE = 100;

function avatarUrl(guildId, member) {
  if (member.avatar) {
    return `https://cdn.discordapp.com/guilds/${guildId}/users/${member.user.id}/avatars/${member.avatar}.png?size=128`;
  }
  if (member.user?.avatar) {
    const extension = member.user.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.${extension}?size=128`;
  }
  return null;
}

function memberCard(guildId, member) {
  return {
    id: member.user.id,
    username: member.user.username,
    globalName: member.user.global_name || null,
    displayName: member.nick || member.user.global_name || member.user.username,
    avatar: avatarUrl(guildId, member),
    bot: member.user.bot === true,
    joinedAt: member.joined_at || null,
    roles: member.roles || [],
  };
}

async function getMemberBatch(guildId, query, after) {
  if (query) {
    try {
      return await botFetch(
        `/guilds/${guildId}/members/search?query=${encodeURIComponent(query)}&limit=${MEMBER_BATCH_SIZE}`,
      );
    } catch {
      const fallback = await botFetch(
        `/guilds/${guildId}/members?limit=1000${after ? `&after=${after}` : ''}`,
      );
      return fallback.filter((member) => {
        const haystack = [
          member.user?.username,
          member.user?.global_name,
          member.nick,
          member.user?.id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query.toLowerCase());
      });
    }
  }
  return botFetch(
    `/guilds/${guildId}/members?limit=${MEMBER_BATCH_SIZE}${after ? `&after=${after}` : ''}`,
  );
}

const GET = guildRoute(async ({ request, guildId }) => {
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);
  const action = (params.get('action') || '').slice(0, 24).toUpperCase();
  const query = (params.get('q') || '').trim().slice(0, 64);
  const memberQuery = query;
  const after = params.get('after') || '';

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

  const [total, items, byAction, memberBatch] = await Promise.all([
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
    getMemberBatch(guildId, memberQuery, after),
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
    members: memberBatch.map((member) => memberCard(guildId, member)),
    memberAfter: !memberQuery && memberBatch.length === MEMBER_BATCH_SIZE
      ? memberBatch[memberBatch.length - 1]?.user?.id || null
      : null,
    memberQuery,
  });
});

module.exports = { GET };
