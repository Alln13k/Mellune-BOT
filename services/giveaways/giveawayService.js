const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const { MELLUNE_DEFAULT_COLOR_INT } = require('../../utils/embeds');

// This service is the single persistence boundary used by Discord interactions
// and scheduler jobs. Giveaway state is always read from PostgreSQL.
const giveawayCrypto = require('node:crypto');

function giveawayColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value || '')
    ? Number.parseInt(value.slice(1), 16)
    : MELLUNE_DEFAULT_COLOR_INT;
}

function giveawayText(giveaway, entryCount, ended = false, winners = []) {
  const end = Math.floor(new Date(giveaway.endsAt).getTime() / 1000);
  const lines = [
    giveaway.description || '',
    giveaway.embedDescription || '',
    '',
    `🎁 Prize: **${giveaway.prize}**`,
    `🏆 Winners: **${giveaway.winners}**`,
    ended
      ? `⏰ Ended <t:${end}:R>`
      : `⏰ Ends: <t:${end}:F> (<t:${end}:R>)`,
    `👥 Entries: **${entryCount}**`,
  ].filter(Boolean);
  if (ended) {
    lines.push(
      winners.length
        ? `\n🎉 Winners: ${winners.map((id) => `<@${id}>`).join(', ')}`
        : '\nNo eligible entrants.',
    );
  }
  return lines.join('\n');
}

function buildGiveawayEmbed(giveaway, entryCount = 0, options = {}) {
  const embed = new EmbedBuilder()
    .setColor(giveawayColor(giveaway.embedColor))
    .setTitle(`🎉 ${giveaway.embedTitle || 'Giveaway'}`)
    .setDescription(
      giveawayText(giveaway, entryCount, options.ended, options.winners || []),
    );
  if (giveaway.authorName) {
    embed.setAuthor({
      name: giveaway.authorName,
      iconURL: giveaway.authorIconUrl || undefined,
    });
  }
  if (giveaway.thumbnailUrl) embed.setThumbnail(giveaway.thumbnailUrl);
  if (giveaway.imageUrl) embed.setImage(giveaway.imageUrl);
  embed.setFooter({
    text: giveaway.footerText || `Mellune giveaway · #${giveaway.id}`,
    iconURL: giveaway.footerIconUrl || undefined,
  });
  if (giveaway.timestamp) embed.setTimestamp();
  if (giveaway.requiredRoleId) {
    embed.addFields({
      name: 'Entry requirement',
      value: `<@&${giveaway.requiredRoleId}>`,
      inline: true,
    });
  }
  return embed;
}

function buildGiveawayMessage(giveaway, entryCount = 0, options = {}) {
  const button = new ButtonBuilder()
    .setCustomId(`giveaway-enter:${giveaway.id}`)
    .setLabel(giveaway.buttonLabel || 'Enter Giveaway')
    .setStyle(ButtonStyle.Primary);
  if (giveaway.buttonEmoji) button.setEmoji(giveaway.buttonEmoji);
  return {
    embeds: [
      buildGiveawayEmbed(giveaway, entryCount, options),
    ],
    components: options.ended
      ? []
      : [new ActionRowBuilder().addComponents(button)],
    allowedMentions: { parse: [] },
  };
}

async function markGiveawayDiscordError(prisma, id, error) {
  await prisma.giveaway.update({
    where: { id },
    data: {
      discordStatus: 'ERROR',
      discordError: String(error.message || error).slice(0, 500),
    },
  }).catch(() => {});
}

async function startPersistentGiveaway(client, giveaway) {
  const prisma = client.prisma;
  try {
    const channel = await client.channels.fetch(giveaway.channelId);
    if (!channel?.isTextBased()) {
      throw new Error('Giveaway channel is not text-based.');
    }
    const entryCount = await prisma.giveawayEntry.count({
      where: { giveawayId: giveaway.id },
    });
    const payload = buildGiveawayMessage(giveaway, entryCount);
    let message = giveaway.messageId
      ? await channel.messages.fetch(giveaway.messageId).catch(() => null)
      : null;
    message = message
      ? await message.edit(payload)
      : await channel.send(payload);
    return prisma.giveaway.update({
      where: { id: giveaway.id },
      data: {
        messageId: message.id,
        status: 'ACTIVE',
        discordStatus: 'SENT',
        discordError: null,
        lastSyncedAt: new Date(),
      },
    });
  } catch (error) {
    await markGiveawayDiscordError(prisma, giveaway.id, error);
    throw error;
  }
}

function giveawayRequirementError(giveaway, member) {
  if (
    giveaway.requiredRoleId &&
    !member?.roles?.cache?.has(giveaway.requiredRoleId)
  ) {
    return 'You need the required role to enter this giveaway.';
  }
  if (
    giveaway.minAccountAgeHours &&
    (!member?.user?.createdTimestamp ||
      Date.now() - member.user.createdTimestamp <
        giveaway.minAccountAgeHours * 3600_000)
  ) {
    return 'Your Discord account is too new to enter this giveaway.';
  }
  if (
    giveaway.minMembershipHours &&
    (!member?.joinedTimestamp ||
      Date.now() - member.joinedTimestamp <
        giveaway.minMembershipHours * 3600_000)
  ) {
    return 'You have not been in this server long enough to enter.';
  }
  return null;
}

async function refreshPersistentGiveaway(client, giveawayId, force = false) {
  const prisma = client.prisma;
  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!giveaway?.messageId || giveaway.discordStatus === 'ERROR') return;
  if (
    !force &&
    giveaway.lastSyncedAt &&
    Date.now() - giveaway.lastSyncedAt.getTime() < 15_000
  ) return;
  try {
    const channel = await client.channels.fetch(giveaway.channelId);
    const message = await channel?.messages.fetch(giveaway.messageId);
    if (!message) return;
    const count = await prisma.giveawayEntry.count({ where: { giveawayId } });
    await message.edit(buildGiveawayMessage(giveaway, count));
    await prisma.giveaway.update({
      where: { id: giveawayId },
      data: {
        lastSyncedAt: new Date(),
        discordStatus: 'SENT',
        discordError: null,
      },
    });
  } catch (error) {
    await markGiveawayDiscordError(prisma, giveawayId, error);
  }
}

async function enterPersistentGiveaway(client, giveawayId, userId, member) {
  const prisma = client.prisma;
  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!giveaway || giveaway.status !== 'ACTIVE' || giveaway.endsAt <= new Date()) {
    return { ok: false, message: 'This giveaway has ended.' };
  }
  const requirementError = giveawayRequirementError(giveaway, member);
  if (requirementError) return { ok: false, message: requirementError };
  const bonusRoles = Array.isArray(giveaway.bonusRoleIds)
    ? giveaway.bonusRoleIds
    : [];
  const weight =
    1 + bonusRoles.filter((roleId) => member?.roles?.cache?.has(roleId)).length;
  try {
    await prisma.giveawayEntry.create({
      data: { giveawayId, guildId: giveaway.guildId, userId, weight },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return { ok: false, message: 'You are already entered.' };
    }
    throw error;
  }
  await refreshPersistentGiveaway(client, giveawayId);
  return { ok: true, message: 'You are entered. Good luck!' };
}

function pickPersistentWinners(entries, count, excluded = new Set()) {
  const pool = entries
    .filter((entry) => !excluded.has(entry.userId))
    .map((entry) => ({
      ...entry,
      weight: Math.max(1, Number(entry.weight) || 1),
    }));
  const winners = [];
  while (pool.length && winners.length < count) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let cursor = giveawayCrypto.randomInt(total);
    let selected = 0;
    for (let index = 0; index < pool.length; index += 1) {
      cursor -= pool[index].weight;
      if (cursor < 0) {
        selected = index;
        break;
      }
    }
    winners.push(pool.splice(selected, 1)[0].userId);
  }
  return winners;
}

async function announcePersistentGiveaway(client, giveaway, winners, entryCount) {
  try {
    const channel = await client.channels.fetch(giveaway.channelId);
    const message = giveaway.messageId
      ? await channel?.messages.fetch(giveaway.messageId).catch(() => null)
      : null;
    await message?.edit({
      ...buildGiveawayMessage(giveaway, entryCount, { ended: true, winners }),
      components: [],
    });
    await channel?.send({
      content: winners.length
        ? `🎉 Giveaway **${giveaway.prize}** ended! Winners: ${winners
            .map((id) => `<@${id}>`)
            .join(', ')}`
        : `🎉 Giveaway **${giveaway.prize}** ended, but there were not enough eligible entries for ${giveaway.winners} winner(s).`,
      allowedMentions: { parse: winners.length ? ['users'] : [] },
    });
    await client.prisma.giveaway.update({
      where: { id: giveaway.id },
      data: {
        discordStatus: 'SENT',
        discordError: null,
        lastSyncedAt: new Date(),
      },
    });
  } catch (error) {
    await markGiveawayDiscordError(client.prisma, giveaway.id, error);
  }
}

async function completePersistentGiveaway(client, giveawayId, options = {}) {
  const prisma = client.prisma;
  const now = new Date();
  const claimed = await prisma.$transaction(async (tx) => {
    const giveaway = await tx.giveaway.findUnique({ where: { id: giveawayId } });
    if (
      !giveaway ||
      giveaway.status !== 'ACTIVE' ||
      (!options.manual && giveaway.endsAt > now)
    ) {
      return null;
    }
    const result = await tx.giveaway.updateMany({
      where: { id: giveawayId, status: 'ACTIVE' },
      data: { status: 'ENDED', endedAt: now },
    });
    return result.count ? giveaway : null;
  });
  if (!claimed) return null;
  const entries = await prisma.giveawayEntry.findMany({ where: { giveawayId } });
  const previous = options.excludePrevious
    ? new Set(
        (await prisma.giveawayWinner.findMany({ where: { giveawayId } }))
          .map((winner) => winner.userId),
      )
    : new Set();
  const winners = pickPersistentWinners(
    entries,
    Math.max(1, Number(options.count) || claimed.winners),
    previous,
  );
  await prisma.$transaction([
    prisma.giveawayWinner.createMany({
      data: winners.map((userId) => ({ giveawayId, userId, round: 0 })),
    }),
    prisma.giveaway.update({
      where: { id: giveawayId },
      data: { winnerIds: winners, discordStatus: 'PENDING' },
    }),
  ]);
  await announcePersistentGiveaway(
    client,
    { ...claimed, winnerIds: winners, status: 'ENDED' },
    winners,
    entries.length,
  );
  return winners;
}

async function processPersistentGiveaways(client) {
  const giveaways = await client.prisma.giveaway.findMany({
    where: { status: 'ACTIVE', endsAt: { lte: new Date() } },
    take: 25,
  });
  for (const giveaway of giveaways) {
    await completePersistentGiveaway(client, giveaway.id).catch((error) =>
      console.error(`Giveaway ${giveaway.id} completion failed:`, error.message),
    );
  }
}

async function rerollPersistentGiveaway(client, giveawayId, options = {}) {
  const prisma = client.prisma;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${giveawayId})`;
    const giveaway = await tx.giveaway.findUnique({ where: { id: giveawayId } });
    if (!giveaway || giveaway.status !== 'ENDED') {
      throw new Error('Giveaway is not ended.');
    }
    const entries = await tx.giveawayEntry.findMany({ where: { giveawayId } });
    const previous = options.excludePrevious
      ? new Set(
          (await tx.giveawayWinner.findMany({ where: { giveawayId } }))
            .map((winner) => winner.userId),
        )
      : new Set();
    const winners = pickPersistentWinners(
      entries,
      Number(options.count) || giveaway.winners,
      previous,
    );
    const lastRound = await tx.giveawayWinner.aggregate({
      where: { giveawayId },
      _max: { round: true },
    });
    const round = (lastRound._max.round || 0) + 1;
    await tx.giveawayWinner.createMany({
      data: winners.map((userId) => ({ giveawayId, userId, round })),
    });
    await tx.giveaway.update({
      where: { id: giveawayId },
      data: { winnerIds: winners },
    });
    return { giveaway, entries, winners };
  });
  await announcePersistentGiveaway(
    client,
    result.giveaway,
    result.winners,
    result.entries.length,
  );
  return result.winners;
}

module.exports = {
  buildGiveawayEmbed,
  buildGiveawayMessage,
  completeGiveaway: completePersistentGiveaway,
  enterGiveaway: enterPersistentGiveaway,
  pickWinners: pickPersistentWinners,
  processEndedGiveaways: processPersistentGiveaways,
  requirementMessage: giveawayRequirementError,
  rerollGiveaway: rerollPersistentGiveaway,
  startGiveaway: startPersistentGiveaway,
};
