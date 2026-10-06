const { NextResponse } = require('next/server');
const { snowflake } = require('../../../../../lib/validate');
const { prisma } = require('../../../../../database/client');
const { guildRoute, badRequest } = require('../../../../../lib/guildRoute');
const { guildResources } = require('../../../../../lib/discordRest');
const { cleanEmbed, queueJob } = require('../../../../../lib/featureApi');
const { MELLUNE_DEFAULT_EMBED_COLOR } = require('../../../../../lib/constants');

const DEFAULT_CATEGORIES = [
  {
    name: 'Support',
    description: 'Get help from the Mellune team.',
    emoji: '✦',
  },
  {
    name: 'Report',
    description: 'Privately report a member or a problem.',
    emoji: '⚑',
  },
  {
    name: 'Partnership',
    description: 'Talk to us about working together.',
    emoji: '◇',
  },
];

function cleanText(value, fallback, maxLength) {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength) || fallback;
}

function cleanColor(value, fallback) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : fallback;
}

function cleanCategory(category) {
  return {
    id: Number.isInteger(category.id) ? category.id : null,
    name: cleanText(category.name, 'Untitled', 48),
    description: cleanText(category.description, 'A new support request.', 240),
    emoji: cleanText(category.emoji, '✦', 8),
    discordCategoryId: snowflake(category.discordCategoryId),
    staffRoleIds: Array.isArray(category.staffRoleIds)
      ? category.staffRoleIds.map(snowflake).filter(Boolean).slice(0, 20)
      : [],
    color: cleanColor(category.color, MELLUNE_DEFAULT_EMBED_COLOR),
    cooldownSeconds: Math.min(
      86400,
      Math.max(0, Number.parseInt(category.cooldownSeconds, 10) || 0),
    ),
    maxOpen: Math.min(
      50,
      Math.max(1, Number.parseInt(category.maxOpen, 10) || 1),
    ),
    enabled: category.enabled !== false,
  };
}

const GET = guildRoute(async ({ guildId }) => {
  const [panels, tickets, total, open, closed, rating] = await Promise.all([
    prisma.ticketPanel.findMany({
      where: { guildId },
      include: { categories: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.ticket.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { category: true, panel: { select: { name: true } } },
    }),
    prisma.ticket.count({ where: { guildId } }),
    prisma.ticket.count({ where: { guildId, status: 'OPEN' } }),
    prisma.ticket.count({ where: { guildId, status: 'CLOSED' } }),
    prisma.ticket.aggregate({
      where: { guildId, rating: { not: null } },
      _avg: { rating: true },
    }),
  ]);
  const resources = await guildResources(guildId);
  return NextResponse.json({
    panels,
    panel: panels[0] || null,
    tickets,
    stats: {
      total,
      open,
      closed,
      averageRating: rating._avg.rating || null,
    },
    channels: resources.channels.filter((channel) =>
      [0, 5].includes(channel.type),
    ),
  });
});

const POST = guildRoute(async ({ request, guildId }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body.');
  }

  if (body.action === 'delete') {
    const panelId = Number(body.id);
    if (!Number.isInteger(panelId)) return badRequest('Invalid panel id.');
    const panel = await prisma.ticketPanel.findFirst({
      where: { id: panelId, guildId },
      select: { id: true },
    });
    if (!panel) return badRequest('Ticket panel not found.');
    await prisma.$transaction([
      prisma.ticketCategory.updateMany({
        where: { guildId, panelId: panel.id },
        data: { panelId: null },
      }),
      prisma.ticketPanel.delete({ where: { id: panel.id } }),
    ]);
    return NextResponse.json({ deleted: true });
  }

  const categories = (
    Array.isArray(body.categories) ? body.categories : DEFAULT_CATEGORIES
  )
    .slice(0, 20)
    .map(cleanCategory);
  const names = new Set(categories.map((category) => category.name));
  if (names.size !== categories.length) {
    return badRequest('Category names must be unique.');
  }
  const panelData = {
    panelKey: cleanText(
      body.panelKey,
      cleanText(body.name, 'support', 60)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'support',
      60,
    ),
    name: cleanText(body.name, 'Support', 80),
    channelId: snowflake(body.channelId),
    title: cleanText(body.title, 'Need a hand?', 120),
    description: cleanText(
      body.description,
      'Choose a category below and our team will be with you shortly.',
      1000,
    ),
    color: cleanColor(body.color, MELLUNE_DEFAULT_EMBED_COLOR),
    emoji: cleanText(body.emoji, '☾', 8),
    imageUrl:
      typeof body.imageUrl === 'string'
        ? body.imageUrl.trim().slice(0, 500) || null
        : null,
    footer:
      typeof body.footer === 'string'
        ? body.footer.trim().slice(0, 240) || null
        : null,
    payload:
      body.payload && typeof body.payload === 'object'
        ? cleanEmbed(body.payload)
        : null,
    buttonLabel: cleanText(body.buttonLabel, 'Open ticket', 80),
    buttonStyle: ['PRIMARY', 'SECONDARY', 'SUCCESS', 'DANGER'].includes(
      body.buttonStyle,
    )
      ? body.buttonStyle
      : 'SECONDARY',
    buttonEmoji: cleanText(body.buttonEmoji, '', 16) || null,
    mentionStaff: body.mentionStaff === true,
    mentionCreator: body.mentionCreator !== false,
    autoWelcome: body.autoWelcome !== false,
    autoAddStaff: body.autoAddStaff !== false,
    maxOpen: Math.min(50, Math.max(1, Number(body.maxOpen) || 1)),
    cooldownSeconds: Math.min(
      86400,
      Math.max(0, Number(body.cooldownSeconds) || 0),
    ),
    enabled: body.enabled !== false,
  };

  const result = await prisma.$transaction(async (transaction) => {
    const existing = body.id
      ? await transaction.ticketPanel.findFirst({
          where: { id: Number(body.id), guildId },
        })
      : null;
    const panel = existing
      ? await transaction.ticketPanel.update({
          where: { id: existing.id },
          data: panelData,
        })
      : await transaction.ticketPanel.create({
          data: { guildId, ...panelData },
        });
    const keptIds = [];
    for (const { id, ...category } of categories) {
      const existing = id
        ? await transaction.ticketCategory.findFirst({
            where: { id, guildId },
          })
        : null;
      const saved = existing
        ? await transaction.ticketCategory.update({
            where: { id: existing.id },
            data: { ...category, panelId: panel.id },
          })
        : await transaction.ticketCategory.create({
            data: { guildId, panelId: panel.id, ...category },
          });
      keptIds.push(saved.id);
    }
    await transaction.ticketCategory.deleteMany({
      where: { guildId, panelId: panel.id, id: { notIn: keptIds } },
    });
    return transaction.ticketPanel.findUnique({
      where: { id: panel.id },
      include: { categories: { orderBy: { createdAt: 'asc' } } },
    });
  });
  let jobId = null;
  if (body.publish && panelData.channelId) {
    const job = await queueJob(prisma, guildId, 'PUBLISH_TICKET_PANEL', {
      panelId: result.id,
      channelId: panelData.channelId,
    });
    jobId = job.id;
  }
  return NextResponse.json({ ...result, jobId }, { status: 200 });
});

module.exports = { GET, POST };
