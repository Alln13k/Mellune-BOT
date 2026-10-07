const { MELLUNE_DEFAULT_EMBED_COLOR } = require('../../lib/constants');
const {
  effectiveStatus,
  formatEventWhen,
  renderHash,
} = require('./eventLogic');

const MELLUNE_DEFAULT_COLOR_INT = Number.parseInt(MELLUNE_DEFAULT_EMBED_COLOR.slice(1), 16);

const pendingSync = new Map();

function colorInt(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value || '')
    ? Number.parseInt(value.slice(1), 16)
    : MELLUNE_DEFAULT_COLOR_INT;
}

function buildEventEmbed(event, counts = {}) {
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
    description: event.embed?.description || event.description || 'Join us for this event.',
    fields: [
      { name: 'Date', value: `📅 ${when.date}\n<t:${unix}:D>`, inline: true },
      {
        name: 'Time',
        value: `🕐 <t:${unix}:t>${endUnix ? ` – <t:${endUnix}:t>` : ''}\n${when.timeZone}`,
        inline: true,
      },
      { name: 'Location', value: `📍 ${location}`.slice(0, 1024), inline: true },
      { name: 'Attendees', value: `👥 ${going}${capacity ? ` / ${capacity}` : ''} going`, inline: true },
      { name: 'Available spots', value: capacity ? `🎟️ ${spots}` : '🎟️ Unlimited', inline: true },
      { name: 'Status', value: `⏳ ${status}\n<t:${unix}:R>`, inline: true },
    ],
    footer: { text: `Organizer ${event.organizerId}` },
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
      eventButton(event.id, 'tentative', 'Tentative', 2, closed),
      eventButton(event.id, 'declined', 'Declined', 4, closed),
    ],
  }];
  if (full && !closed) {
    rows.push({ type: 1, components: [eventButton(event.id, 'waitlist', 'Join waitlist', 1)] });
  }
  return rows;
}

function buildEventPayload(event, counts) {
  return {
    embeds: [buildEventEmbed(event, counts)],
    components: buildEventComponents(event, counts),
    allowedMentions: { parse: [] },
    allowed_mentions: { parse: [] },
  };
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
  await message.edit(buildEventPayload(event, counts));
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
  buildEventEmbed,
  buildEventPayload,
  countResponses,
  createDiscussionThread,
  refreshEventMessage,
  scheduleMessageSync,
};
