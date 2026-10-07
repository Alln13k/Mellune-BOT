const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');
const { MELLUNE_DEFAULT_EMBED_COLOR } = require('../../lib/constants');
const {
  effectiveStatus,
  formatEventWhen,
  renderHash,
  statusLabel,
} = require('./eventLogic');

const MELLUNE_DEFAULT_COLOR_INT = Number.parseInt(MELLUNE_DEFAULT_EMBED_COLOR.slice(1), 16);
const EVENT_CARD_FONTS = [
  path.join(__dirname, '../../assets/fonts/Inter-Regular.ttf'),
  path.join(__dirname, '../../assets/fonts/Inter-Bold.ttf'),
];
const EVENT_CARD_WIDTH = 1200;
const EVENT_CARD_HEIGHT = 675;

const pendingSync = new Map();

function colorInt(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value || '')
    ? Number.parseInt(value.slice(1), 16)
    : MELLUNE_DEFAULT_COLOR_INT;
}

function escapeSvg(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function clipText(value, max) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function compactNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

async function inlineImage(url) {
  if (!url || String(url).startsWith('data:')) return url || null;
  try {
    const response = await fetch(url, { signal: globalThis.AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const type = (response.headers.get('content-type') || 'image/png').split(';')[0].trim();
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(type)) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 3_000_000) return null;
    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch (error) {
    console.error('Event card image fetch failed:', error.message);
    return null;
  }
}

function eventCardSvg(event, counts, background) {
  const when = formatEventWhen(event);
  const status = statusLabel(effectiveStatus(event));
  const going = counts.going || 0;
  const waiting = counts.waitlist || 0;
  const capacity = event.maxAttendees || null;
  const capacityLabel = capacity ? `${going} / ${capacity}` : `${going}`;
  const name = clipText(event.name, 36);
  const description = clipText(event.description || 'Tap Going to join this event.', 76);
  const location = clipText(event.location || 'Discord', 36);
  const progress = capacity ? Math.min(1, going / capacity) : 1;
  const progressWidth = Math.round(430 * progress);
  const backgroundMarkup = background
    ? `<image href="${escapeSvg(background)}" x="0" y="0" width="${EVENT_CARD_WIDTH}" height="${EVENT_CARD_HEIGHT}" preserveAspectRatio="xMidYMid slice"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${EVENT_CARD_WIDTH}" height="${EVENT_CARD_HEIGHT}" viewBox="0 0 ${EVENT_CARD_WIDTH} ${EVENT_CARD_HEIGHT}">
    <defs>
      <linearGradient id="shade" x1="0" x2="1" y1="0" y2="1">
        <stop stop-color="#0b0e16" stop-opacity="0.96"/>
        <stop offset="0.58" stop-color="#151c2c" stop-opacity="0.86"/>
        <stop offset="1" stop-color="#3C527F" stop-opacity="0.92"/>
      </linearGradient>
      <linearGradient id="accent" x1="0" x2="1">
        <stop stop-color="#3C527F"/>
        <stop offset="1" stop-color="#8ca9dc"/>
      </linearGradient>
      <clipPath id="card"><rect width="${EVENT_CARD_WIDTH}" height="${EVENT_CARD_HEIGHT}" rx="32"/></clipPath>
    </defs>
    <rect width="${EVENT_CARD_WIDTH}" height="${EVENT_CARD_HEIGHT}" rx="32" fill="#10131b"/>
    <g clip-path="url(#card)">${backgroundMarkup}<rect width="${EVENT_CARD_WIDTH}" height="${EVENT_CARD_HEIGHT}" fill="url(#shade)"/></g>
    <rect x="34" y="34" width="1132" height="607" rx="26" fill="#111622" fill-opacity="0.48" stroke="#9ab7ef" stroke-opacity="0.32"/>
    <text x="78" y="92" fill="#c9d8f7" font-family="Inter" font-size="22" font-weight="700" letter-spacing="3">MELLUNE EVENT</text>
    <text x="78" y="174" fill="#ffffff" font-family="Inter" font-size="52" font-weight="700">${escapeSvg(name)}</text>
    <text x="78" y="220" fill="#d6def0" font-family="Inter" font-size="24">${escapeSvg(description)}</text>
    <text x="78" y="300" fill="#ffffff" font-family="Inter" font-size="27" font-weight="700">DATE  ·  ${escapeSvg(when.date)}</text>
    <text x="78" y="340" fill="#d6def0" font-family="Inter" font-size="23">TIME  ·  ${escapeSvg(when.time)} · ${escapeSvg(when.timeZone)}</text>
    <text x="78" y="380" fill="#d6def0" font-family="Inter" font-size="23">PLACE  ·  ${escapeSvg(location)}</text>
    <rect x="78" y="430" width="430" height="18" rx="9" fill="#303746"/>
    <rect x="78" y="430" width="${progressWidth}" height="18" rx="9" fill="url(#accent)"/>
    <text x="78" y="498" fill="#ffffff" font-family="Inter" font-size="38" font-weight="700">${escapeSvg(capacityLabel)}</text>
    <text x="78" y="535" fill="#c9d8f7" font-family="Inter" font-size="22">${capacity ? 'people going' : 'people going · no limit'}</text>
    <text x="78" y="590" fill="#b5c0d8" font-family="Inter" font-size="20">${waiting ? `${compactNumber(waiting)} waiting · ` : ''}Starts ${escapeSvg(when.date)} at ${escapeSvg(when.time)}</text>
    <rect x="784" y="424" width="300" height="92" rx="18" fill="#3C527F" fill-opacity="0.82"/>
    <text x="934" y="465" text-anchor="middle" fill="#ffffff" font-family="Inter" font-size="25" font-weight="700">${escapeSvg(status)}</text>
    <text x="934" y="496" text-anchor="middle" fill="#d9e5ff" font-family="Inter" font-size="18">Tap Going below</text>
  </svg>`;
}

async function buildEventCardPng(event, counts = {}, backgroundUrl = null) {
  const background = await inlineImage(backgroundUrl);
  const resvg = new Resvg(eventCardSvg(event, counts, background), {
    fitTo: { mode: 'width', value: EVENT_CARD_WIDTH },
    font: {
      fontFiles: EVENT_CARD_FONTS,
      loadSystemFonts: false,
      defaultFontFamily: 'Inter',
    },
  });
  const png = resvg.render().asPng();
  if (!png?.length) throw new Error('Event card render produced an empty image.');
  return Buffer.from(png);
}

function buildEventEmbed(event, counts = {}, renderedImageUrl = null) {
  if (renderedImageUrl) {
    return {
      color: colorInt(event.color),
      image: { url: renderedImageUrl },
    };
  }
  const when = formatEventWhen(event);
  const going = counts.going || 0;
  const capacity = event.maxAttendees || null;
  const spots = capacity ? Math.max(0, capacity - going) : null;
  const status = effectiveStatus(event);
  const location = event.location || (event.channelId ? `<#${event.channelId}>` : 'Discord');
  const unix = Math.floor(new Date(event.startAt).getTime() / 1000);
  const endUnix = event.endAt ? Math.floor(new Date(event.endAt).getTime() / 1000) : null;
  const embed = {
    color: colorInt(event.color),
    title: event.embed?.title || event.name,
    description: event.embed?.description || event.description || 'Tap **Going** to join now. Mellune DMs you 15 minutes before and when it starts.',
    fields: [
      { name: 'Date', value: `📅 ${when.date}\n<t:${unix}:D>`, inline: true },
      {
        name: 'Time',
        value: `🕐 <t:${unix}:t>${endUnix ? ` – <t:${endUnix}:t>` : ''}\n${when.timeZone}`,
        inline: true,
      },
      { name: 'Location', value: `📍 ${location}`.slice(0, 1024), inline: true },
      { name: 'Attendees', value: `👥 ${going}${capacity ? ` / ${capacity}` : ''} going`, inline: true },
      { name: 'Available spots', value: capacity ? `🎟️ ${spots} left` : '🎟️ No limit', inline: true },
      { name: 'Status', value: `${statusLabel(status)}\n<t:${unix}:R>`, inline: true },
    ],
    footer: { text: 'Going gets an automatic DM 15 minutes before and when it starts.' },
  };
  if (event.imageUrl) embed.image = { url: event.imageUrl };
  return embed;
}

function eventButton(eventId, action, label, style, disabled = false) {
  return {
    type: 2,
    custom_id: `event:${action}:${eventId}`,
    label,
    style,
    disabled,
  };
}

function buildEventComponents(event, counts = {}) {
  const status = effectiveStatus(event);
  const closed = !event.rsvpEnabled || ['DRAFT', 'SCHEDULED', 'ENDED', 'CANCELLED'].includes(status);
  const full = Boolean(event.maxAttendees && (counts.going || 0) >= event.maxAttendees);
  const rows = [{
    type: 1,
    components: [
      eventButton(event.id, 'going', 'Going', 3, closed),
      eventButton(event.id, 'tentative', 'Maybe', 2, closed),
      eventButton(event.id, 'declined', "Can't go", 4, closed),
    ],
  }];
  if (full && !closed) {
    rows.push({ type: 1, components: [eventButton(event.id, 'waitlist', 'Join the waitlist', 1)] });
  }
  return rows;
}

function buildEventPayload(event, counts, renderedImageUrl = null) {
  return {
    embeds: [buildEventEmbed(event, counts, renderedImageUrl)],
    components: buildEventComponents(event, counts),
    allowedMentions: { parse: [] },
    allowed_mentions: { parse: [] },
  };
}

function multipartPayload(payload, image) {
  const form = new globalThis.FormData();
  form.append('payload_json', JSON.stringify({
    ...apiPayload(payload),
    attachments: [{ id: 0, filename: 'event-card.png' }],
  }));
  form.append('files[0]', new globalThis.Blob([image], { type: 'image/png' }), 'event-card.png');
  return form;
}

function apiPayload(payload) {
  return {
    embeds: payload.embeds,
    components: payload.components,
    allowed_mentions: { parse: [] },
  };
}

async function countResponses(prisma, eventId) {
  const grouped = await prisma.communityEventRsvp.groupBy({
    by: ['status'],
    where: { eventId },
    _count: { _all: true },
  });
  const counts = { going: 0, tentative: 0, declined: 0, waitlist: 0 };
  for (const row of grouped) {
    const key = String(row.status || '').toLowerCase();
    if (key in counts) counts[key] = row._count._all;
  }
  counts.waitlist = await prisma.communityEventWaitlistEntry.count({ where: { eventId } });
  return counts;
}

async function refreshEventMessage(client, eventId) {
  const prisma = client.prisma;
  const event = await prisma.communityEvent.findUnique({ where: { id: eventId } });
  if (!event?.channelId || !event.messageId) return event;
  const counts = await countResponses(prisma, event.id);
  const hash = renderHash(event, counts);
  if (event.messageHash === hash) return event;
  const channel = await client.channels.fetch(event.channelId).catch(() => null);
  const message = await channel?.messages?.fetch(event.messageId).catch(() => null);
  if (!message) return event;
  const guild = client.guilds?.cache?.get(event.guildId)
    || (client.guilds?.fetch ? await client.guilds.fetch(event.guildId).catch(() => null) : null);
  const background = event.imageUrl || guild?.iconURL?.({ extension: 'png', size: 512 }) || null;
  const image = await buildEventCardPng(event, counts, background).catch((error) => {
    console.error(`Event card render failed for ${event.id}:`, error.message);
    return null;
  });
  const payload = buildEventPayload(event, counts, image ? 'attachment://event-card.png' : null);
  if (image) payload.files = [{ attachment: image, name: 'event-card.png' }];
  await message.edit(payload);
  return prisma.communityEvent.update({
    where: { id: event.id },
    data: { messageHash: hash },
  });
}

function scheduleMessageSync(client, eventId) {
  if (!client || !eventId) return;
  const existing = pendingSync.get(eventId);
  if (existing) globalThis.clearTimeout(existing);
  pendingSync.set(eventId, globalThis.setTimeout(() => {
    pendingSync.delete(eventId);
    refreshEventMessage(client, eventId).catch((error) => {
      console.error(`Event message sync failed for ${eventId}:`, error.message);
    });
  }, 1500));
}

async function createDiscussionThread(message, event) {
  if (!event.threadEnabled || event.threadId) return event.threadId || null;
  const thread = await message.startThread({
    name: event.name.slice(0, 100),
    autoArchiveDuration: 1440,
    reason: 'Mellune event discussion',
  });
  return thread.id;
}

async function archiveEventThread(client, event) {
  if (!client || !event.threadId || event.archiveThread === false) return;
  const thread = await client.channels.fetch(event.threadId).catch(() => null);
  if (!thread) return;
  await thread.setLocked(true).catch(() => {});
  await thread.setArchived(true).catch(() => {});
}

module.exports = {
  apiPayload,
  archiveEventThread,
  buildEventComponents,
  buildEventCardPng,
  buildEventEmbed,
  buildEventPayload,
  countResponses,
  createDiscussionThread,
  multipartPayload,
  refreshEventMessage,
  scheduleMessageSync,
};
