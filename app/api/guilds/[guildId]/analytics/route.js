const { prisma } = require('../../../../../database/client');
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
  const activity = await prisma.activityEvent.findMany({
    where: { guildId, createdAt: { gte: since } },
    select: { kind: true, createdAt: true },
  });
  const count = (kind) =>
    activity.filter((event) => event.kind === kind).length;
  const metric = (kind) =>
    bucketize(
      activity
        .filter((event) => event.kind === kind)
        .map((event) => event.createdAt),
      range,
    );
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
      members,
      joins: count('JOIN'),
      leaves: count('LEAVE'),
      netGrowth: count('JOIN') - count('LEAVE'),
      messages: count('MESSAGE'),
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
    ],
  });
});

module.exports = { GET };
