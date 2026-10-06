const { NextResponse } = require('next/server');
const { prisma } = require('../../../../../database/client');
const { requireGuildAccess } = require('../../../../../lib/apiAuth');

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
    name: cleanText(category.name, 'Untitled', 48),
    description: cleanText(category.description, 'A new support request.', 240),
    emoji: cleanText(category.emoji, '✦', 8),
    discordCategoryId:
      typeof category.discordCategoryId === 'string'
        ? category.discordCategoryId.slice(0, 32)
        : null,
    staffRoleIds: Array.isArray(category.staffRoleIds)
      ? category.staffRoleIds
          .filter((id) => typeof id === 'string')
          .slice(0, 20)
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

async function GET(request, { params }) {
  const { guildId } = await params;
  const authorization = await requireGuildAccess(request, guildId);
  if (authorization.error) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }

  const [panel, categories] = await Promise.all([
    prisma.ticketPanel.findUnique({ where: { guildId } }),
    prisma.ticketCategory.findMany({
      where: { guildId },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  return NextResponse.json({ panel, categories });
}

async function POST(request, { params }) {
  const { guildId } = await params;
  const authorization = await requireGuildAccess(request, guildId);
  if (authorization.error) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const categories = Array.isArray(body.categories)
    ? body.categories.slice(0, 20).map(cleanCategory)
    : DEFAULT_CATEGORIES.map(cleanCategory);
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
    for (const category of categories) {
      await transaction.ticketCategory.upsert({
        where: { guildId_name: { guildId, name: category.name } },
        update: { ...category, panelId: panel.id },
        create: { guildId, panelId: panel.id, ...category },
      });
    }
    return transaction.ticketPanel.findUnique({
      where: { id: panel.id },
      include: { categories: { orderBy: { createdAt: 'asc' } } },
    });
  });
  return NextResponse.json(result, { status: 200 });
}

module.exports = { GET, POST };
