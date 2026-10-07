const { prisma } = require('../../../../../database/client');
const {
  cleanUrl,
  featureRoute,
  getResources,
  queueJob,
  readBody,
  response,
  snowflake,
  text,
} = require('../../../../../lib/featureApi');
const { color } = require('../../../../../lib/validate');
const { MELLUNE_DEFAULT_EMBED_COLOR } = require('../../../../../lib/constants');
const { parseGiveawayDuration } = require('../../../../../lib/giveawayDuration');
const { botFetch } = require('../../../../../lib/discordRest');

function discordGiveawayPayload(giveaway) {
  const end = Math.floor(new Date(giveaway.endsAt).getTime() / 1000);
  const description = [
    giveaway.description,
    giveaway.embedDescription,
    '',
    `🎁 Prize: **${giveaway.prize}**`,
    `🏆 Winners: **${giveaway.winners}**`,
    `⏰ Ends: <t:${end}:F> (<t:${end}:R>)`,
    '👥 Entries: **0**',
  ].filter(Boolean).join('\n');
  const embed = {
    title: `🎉 ${giveaway.embedTitle || 'Giveaway'}`,
    description,
    color: Number.parseInt(giveaway.embedColor.slice(1), 16),
    footer: {
      text: giveaway.footerText || `Mellune giveaway · #${giveaway.id}`,
      ...(giveaway.footerIconUrl ? { icon_url: giveaway.footerIconUrl } : {}),
    },
    ...(giveaway.timestamp ? { timestamp: new Date().toISOString() } : {}),
    ...(giveaway.authorName
      ? {
          author: {
            name: giveaway.authorName,
            ...(giveaway.authorIconUrl ? { icon_url: giveaway.authorIconUrl } : {}),
          },
        }
      : {}),
    ...(giveaway.thumbnailUrl ? { thumbnail: { url: giveaway.thumbnailUrl } } : {}),
    ...(giveaway.imageUrl ? { image: { url: giveaway.imageUrl } } : {}),
    ...(giveaway.requiredRoleId
      ? {
          fields: [{
            name: 'Entry requirement',
            value: `<@&${giveaway.requiredRoleId}>`,
            inline: true,
          }],
        }
      : {}),
  };
  return {
    embeds: [embed],
    components: [{
      type: 1,
      components: [{
        type: 2,
        custom_id: `giveaway-enter:${giveaway.id}`,
        style: 1,
        label: giveaway.buttonLabel || 'Enter Giveaway',
        ...(giveaway.buttonEmoji
          ? { emoji: { name: giveaway.buttonEmoji } }
          : {}),
      }],
    }],
    allowed_mentions: { parse: [] },
  };
}

const GET = featureRoute(async ({ guildId }) => {
  const [giveaways, resources] = await Promise.all([
    prisma.giveaway.findMany({
      where: { guildId },
      include: {
        _count: { select: { entries: true } },
        winnerHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    getResources(guildId),
  ]);
  return response({
    giveaways,
    channels: resources.channels.filter((channel) =>
      [0, 5].includes(channel.type),
    ),
    roles: resources.roles,
  });
});

const POST = featureRoute(async ({ request, guildId, session }) => {
  const body = await readBody(request);
  const action = body.action || 'start';
  const invalid = (message) => response({ error: message }, 400);
  if (action === 'reroll') {
    const giveaway = await prisma.giveaway.findFirst({
      where: { id: Number(body.id), guildId, status: 'ENDED' },
    });
    if (!giveaway) return invalid('Ended giveaway not found.');
    const requestedCount = Number(body.count);
    if (
      body.count !== undefined &&
      (!Number.isInteger(requestedCount) ||
        requestedCount < 1 ||
        requestedCount > 20)
    ) {
      return invalid('Reroll winner count must be a whole number from 1 to 20.');
    }
    const job = await queueJob(prisma, guildId, 'REROLL_GIVEAWAY', {
      giveawayId: giveaway.id,
      count: requestedCount || giveaway.winners,
      excludePrevious: body.excludePrevious === true,
    });
    return response({ queued: true, jobId: job.id }, 202);
  }
  if (action === 'end') {
    const giveaway = await prisma.giveaway.findFirst({
      where: { id: Number(body.id), guildId, status: 'ACTIVE' },
    });
    if (!giveaway) return invalid('Active giveaway not found.');
    const job = await queueJob(prisma, guildId, 'END_GIVEAWAY', {
      giveawayId: giveaway.id,
    });
    return response({ queued: true, jobId: job.id }, 202);
  }
  let durationSeconds;
  try {
    durationSeconds = parseGiveawayDuration(
      body.durationAmount,
      body.durationUnit,
    );
  } catch (error) {
    return invalid(error.message);
  }
  const channelId = snowflake(body.channelId);
  if (!channelId) return invalid('Choose a Discord channel.');
  const startAt = new Date();
  const endsAt = new Date(startAt.getTime() + durationSeconds * 1000);
  const bonusRoleIds = Array.isArray(body.bonusRoleIds)
    ? body.bonusRoleIds.map(snowflake).filter(Boolean).slice(0, 10)
    : [];
  const prize = text(body.prize, 200, '');
  if (!prize) return invalid('Enter a giveaway prize.');
  const winnerCount = Number(body.winners);
  if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > 20) {
    return invalid('Number of winners must be a whole number from 1 to 20.');
  }
  const positiveInt = (value, label, max = 8760) => {
    if (value === undefined || value === null || value === '') return 0;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) {
      throw new Error(`${label} must be a whole number from 0 to ${max}.`);
    }
    return parsed;
  };
  let minAccountAgeHours;
  let minMembershipHours;
  try {
    minAccountAgeHours = positiveInt(
      body.minAccountAgeHours,
      'Minimum account age',
    );
    minMembershipHours = positiveInt(
      body.minMembershipHours,
      'Minimum server membership',
    );
  } catch (error) {
    return invalid(error.message);
  }
  const giveaway = await prisma.giveaway.create({
    data: {
      guildId,
      channelId,
      prize,
      winners: winnerCount,
      description: text(body.description, 4096) || null,
      embedTitle: text(body.embedTitle, 256) || null,
      embedDescription: text(body.embedDescription, 4096) || null,
      embedColor: color(body.embedColor, MELLUNE_DEFAULT_EMBED_COLOR),
      thumbnailUrl: cleanUrl(body.thumbnailUrl),
      imageUrl: cleanUrl(body.imageUrl),
      authorName: text(body.authorName, 256) || null,
      authorIconUrl: cleanUrl(body.authorIconUrl),
      footerText: text(body.footerText, 2048) || null,
      footerIconUrl: cleanUrl(body.footerIconUrl),
      timestamp: body.timestamp !== false,
      buttonLabel: text(body.buttonLabel, 80, 'Enter Giveaway'),
      buttonEmoji: text(body.buttonEmoji, 32, '🎉'),
      endsAt,
      startAt,
      durationSeconds,
      requiredRoleId: snowflake(body.requiredRoleId),
      bonusRoleIds,
      minAccountAgeHours,
      minMembershipHours,
      entryRequirements: body.entryRequirements || null,
      startedBy: session.user.id,
      status: 'QUEUED',
      discordStatus: 'PENDING',
    },
  });
  try {
    const payload = discordGiveawayPayload(giveaway);
    const discordMessage = await botFetch(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
      }),
    });
    const sent = await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: {
        messageId: discordMessage.id,
        status: 'ACTIVE',
        discordStatus: 'SENT',
        lastSyncedAt: new Date(),
      },
    });
    return response({ giveaway: sent, delivery: 'sent' }, 201);
  } catch (error) {
    const queued = await queueJob(prisma, guildId, 'START_GIVEAWAY', {
      giveawayId: giveaway.id,
    });
    const pending = await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: {
        discordStatus: 'QUEUED',
        discordError: error.message.slice(0, 500),
      },
    });
    return response(
      {
        giveaway: pending,
        delivery: 'queued',
        jobId: queued.id,
        warning: 'Discord could not be contacted immediately; the bot will retry.',
      },
      202,
    );
  }
});

module.exports = { GET, POST };
