const { prisma } = require('../../../../../../database/client');
const { botFetch } = require('../../../../../../lib/discordRest');
const { guildRoute } = require('../../../../../../lib/guildRoute');
const { response, text } = require('../../../../../../lib/featureApi');

async function discordUser(guildId, userId) {
  try {
    const member = await botFetch(`/guilds/${guildId}/members/${userId}`);
    return {
      id: userId,
      username: member.user?.username || userId,
      displayName: member.nick || member.user?.global_name || member.user?.username || userId,
      avatar: member.user?.avatar || null,
    };
  } catch {
    try {
      const user = await botFetch(`/users/${userId}`);
      return {
        id: userId,
        username: user.username || userId,
        displayName: user.global_name || user.username || userId,
        avatar: user.avatar || null,
      };
    } catch {
      return {
        id: userId,
        username: userId,
        displayName: userId,
        avatar: null,
      };
    }
  }
}

const GET = guildRoute(async ({ request, guildId, params }) => {
  const giveawayId = Number(params.giveawayId);
  if (!Number.isInteger(giveawayId)) {
    return response({ error: 'Invalid giveaway id.' }, 400);
  }
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize')) || 25));
  const search = text(url.searchParams.get('search'), 100) || '';
  const giveaway = await prisma.giveaway.findFirst({
    where: { id: giveawayId, guildId },
    include: {
      _count: { select: { entries: true } },
      winnerHistory: { orderBy: [{ round: 'desc' }, { createdAt: 'desc' }] },
    },
  });
  if (!giveaway) return response({ error: 'Giveaway not found.' }, 404);
  const entryWhere = {
    giveawayId,
    guildId,
    ...(search ? { userId: { contains: search, mode: 'insensitive' } } : {}),
  };
  const [entries, total] = await Promise.all([
    prisma.giveawayEntry.findMany({
      where: entryWhere,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.giveawayEntry.count({ where: entryWhere }),
  ]);
  const users = await Promise.all(
    entries.map((entry) => discordUser(guildId, entry.userId)),
  );
  return response({
    giveaway,
    entries: entries.map((entry, index) => ({
      ...entry,
      user: users[index],
    })),
    pagination: {
      page,
      pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
});

const DELETE = guildRoute(async ({ guildId, params }) => {
  const giveawayId = Number(params.giveawayId);
  const giveaway = await prisma.giveaway.findFirst({
    where: { id: giveawayId, guildId },
  });
  if (!giveaway) return response({ error: 'Giveaway not found.' }, 404);
  let discordMessageDeleted = false;
  if (giveaway.messageId) {
    try {
      await botFetch(`/channels/${giveaway.channelId}/messages/${giveaway.messageId}`, {
        method: 'DELETE',
      });
      discordMessageDeleted = true;
    } catch {
      // The dashboard record is still safely removable when Discord already
      // removed the channel/message or the bot temporarily lacks access.
    }
  }
  await prisma.giveaway.delete({ where: { id: giveawayId } });
  return response({ deleted: true, discordMessageDeleted });
});

module.exports = { DELETE, GET };
