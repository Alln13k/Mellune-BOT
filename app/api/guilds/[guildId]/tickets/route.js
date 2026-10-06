const { NextResponse } = require('next/server');
const { snowflake } = require('../../../../../lib/validate');
const { prisma } = require('../../../../../database/client');
const { guildRoute, badRequest } = require('../../../../../lib/guildRoute');

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
    color: cleanColor(category.color, '#b9a7ff'),
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
  const [panel, categories] = await Promise.all([
    prisma.ticketPanel.findUnique({ where: { guildId } }),
    prisma.ticketCategory.findMany({
      where: { guildId },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  return NextResponse.json({ panel, categories });
});

const POST = guildRoute(async ({ request, guildId }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body.');
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
    title: cleanText(body.title, 'Need a hand?', 120),
    description: cleanText(
      body.description,
      'Choose a category below and our team will be with you shortly.',
      1000,
    ),
    color: cleanColor(body.color, '#b9a7ff'),
    emoji: cleanText(body.emoji, '☾', 8),
    imageUrl:
      typeof body.imageUrl === 'string'
        ? body.imageUrl.trim().slice(0, 500) || null
        : null,
    footer:
      typeof body.footer === 'string'
        ? body.footer.trim().slice(0, 240) || null
        : null,
    enabled: body.enabled !== false,
  };

  const result = await prisma.$transaction(async (transaction) => {
    const panel = await transaction.ticketPanel.upsert({
      where: { guildId },
      update: panelData,
      create: { guildId, ...panelData },
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
        : await transaction.ticketCategory.upsert({
            where: { guildId_name: { guildId, name: category.name } },
            update: { ...category, panelId: panel.id },
            create: { guildId, panelId: panel.id, ...category },
          });
      keptIds.push(saved.id);
    }
    await transaction.ticketCategory.deleteMany({
      where: { guildId, id: { notIn: keptIds } },
    });
    return transaction.ticketPanel.findUnique({
      where: { id: panel.id },
      include: { categories: { orderBy: { createdAt: 'asc' } } },
    });
  });
  return NextResponse.json(result, { status: 200 });
});

module.exports = { GET, POST };
