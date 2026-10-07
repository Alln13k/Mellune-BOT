const { prisma } = require('../../../../../database/client');
const { botFetch } = require('../../../../../lib/discordRest');
const { guildRoute } = require('../../../../../lib/guildRoute');
const {
  bucketize,
  getRangeStart,
  parseRange,
} = require('../../../../../lib/analytics');
const { response } = require('../../../../../lib/featureApi');

const GET = guildRoute(async ({ request, guildId }) => {
  const range = parseRange(new URL(request.url).searchParams.get('range'));
  const since = getRangeStart(range);
  const [activity, discordGuild] = await Promise.all([
    prisma.activityEvent.findMany({
      where: { guildId, createdAt: { gte: since } },
      select: { kind: true, userId: true, createdAt: true },
    }),
    botFetch(`/guilds/${guildId}?with_counts=true`).catch(() => null),
  ]);
  const count = (kind) =>
    activity.filter((event) => event.kind === kind).length;
  const metric = (kind) =>
    bucketize(
      activity
        .filter((event) => event.kind === kind)
        .map((event) => event.createdAt),
      range,
    );
  const currentMembers =
    discordGuild?.member_count ?? discordGuild?.approximate_member_count ?? null;
  const activeMembers = new Set(
    activity
      .filter((event) => event.kind === 'MESSAGE' && event.userId)
      .map((event) => event.userId),
  ).size;
  const [members, tickets, moderation, giveaways, verifications] =
    await Promise.all([
      prisma.user.count({ where: { guildId } }),
      prisma.ticket.count({ where: { guildId, createdAt: { gte: since } } }),
      prisma.moderationCase.count({
        where: { guildId, createdAt: { gte: since } },
      }),
      prisma.giveaway.count({ where: { guildId, createdAt: { gte: since } } }),
      Promise.resolve(count('VERIFICATION')),
    ]);
  return response({
    range,
    totals: {
      members: currentMembers,
      trackedMembers: members,
      activeMembers,
      joins: count('JOIN'),
      leaves: count('LEAVE'),
      netGrowth: count('JOIN') - count('LEAVE'),
      messages: count('MESSAGE'),
      levelUps: count('LEVEL_UP'),
      tickets,
      moderation,
      giveaways,
      verifications,
    },
    series: [
      { key: 'joins', label: 'Joins', points: metric('JOIN') },
      { key: 'leaves', label: 'Leaves', points: metric('LEAVE') },
      { key: 'messages', label: 'Messages', points: metric('MESSAGE') },
      { key: 'moderation', label: 'Moderation', points: metric('MODERATION') },
      { key: 'levelUps', label: 'Level ups', points: metric('LEVEL_UP') },
    ],
  });
});

module.exports = { GET };
