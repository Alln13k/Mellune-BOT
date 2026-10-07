const { botFetch } = require('../../lib/discordRest');
const {
  asArray,
  buildStats,
  decideRsvp,
  duplicateInput,
  effectiveStatus,
  inputError,
  matchesBucket,
  nextPosition,
  normalizeEventInput,
  paginate,
  planSeriesInstances,
  reminderRunAt,
  renderHash,
  resequence,
} = require('./eventLogic');
const {
  archiveEventThread,
  apiPayload,
  buildEventPayload,
  countResponses,
  createDiscussionThread,
  refreshEventMessage,
  scheduleMessageSync,
} = require('./eventMessage');

const ACTIONS = new Set([
  'CREATED', 'EDITED', 'PUBLISHED', 'RSVP', 'CAPACITY', 'PROMOTED',
  'REMINDER', 'RESCHEDULED', 'CANCELLED', 'ENDED', 'WAITLIST', 'DUPLICATED',
]);

function publicEvent(event, counts = {}) {
  if (!event) return null;
  return {
    ...event,
    status: effectiveStatus(event),
    storedStatus: event.status,
    counts: {
      going: counts.going || 0,
      tentative: counts.tentative || 0,
      declined: counts.declined || 0,
      waitlist: counts.waitlist || 0,
    },
  };
}

function avatarUrl(userId, avatar) {
  if (!userId || !avatar) return null;
  const extension = String(avatar).startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${extension}?size=128`;
}

function publicPerson(record) {
  return {
    id: record.userId,
    username: record.username,
    displayName: record.displayName || record.username,
    avatar: avatarUrl(record.userId, record.avatar),
    status: record.status || 'WAITLIST',
    position: record.position || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt || record.createdAt,
  };
}

async function logEvent(tx, event, action, actorId, metadata) {
  if (!ACTIONS.has(action)) return null;
  return tx.communityEventLog.create({
    data: {
      eventId: event.id,
      guildId: event.guildId,
      action,
      actorId: actorId || null,
      metadata: metadata || undefined,
    },
  });
}

async function ensureServer(prisma, guildId, guildName) {
  const existing = await prisma.guild.findUnique({ where: { id: guildId } });
  if (existing) return existing;
  return prisma.guild.create({ data: { id: guildId, name: guildName || 'Server' } });
}

async function resequenceWaitlist(tx, eventId) {
  const entries = await tx.communityEventWaitlistEntry.findMany({
    where: { eventId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  for (const entry of resequence(entries)) {
    const current = entries.find((item) => item.id === entry.id);
    if (current && current.position !== entry.position) {
      await tx.communityEventWaitlistEntry.update({
        where: { id: entry.id },
        data: { position: entry.position },
      });
    }
  }
}

async function promoteFirst(tx, event, actorId) {
  const next = await tx.communityEventWaitlistEntry.findFirst({
    where: { eventId: event.id },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  if (!next) return null;
  await tx.communityEventRsvp.upsert({
    where: { eventId_userId: { eventId: event.id, userId: next.userId } },
    create: {
      eventId: event.id,
      guildId: event.guildId,
      userId: next.userId,
      username: next.username,
      displayName: next.displayName,
      avatar: next.avatar,
      status: 'GOING',
    },
    update: { status: 'GOING', username: next.username, displayName: next.displayName },
  });
  await tx.communityEventWaitlistEntry.delete({ where: { id: next.id } });
  await resequenceWaitlist(tx, event.id);
  await logEvent(tx, event, 'PROMOTED', actorId || next.userId, { userId: next.userId });
  return next;
}

async function applyLockedRsvp(tx, { guildId, eventId, user, requested, skipEligibility = false }) {
  const event = await tx.communityEvent.findFirst({ where: { id: eventId, guildId } });
  if (!event) throw Object.assign(new Error('Event not found.'), { status: 404 });
  const goingCount = await tx.communityEventRsvp.count({ where: { eventId, status: 'GOING' } });
  const existing = await tx.communityEventRsvp.findUnique({
    where: { eventId_userId: { eventId, userId: user.userId } },
  });
  const waitEntry = await tx.communityEventWaitlistEntry.findUnique({
    where: { eventId_userId: { eventId, userId: user.userId } },
  });
  const decision = decideRsvp({
    event,
    memberRoleIds: user.roleIds || [],
    existingStatus: existing?.status || null,
    waitlisted: Boolean(waitEntry),
    goingCount,
    requested,
    skipEligibility,
  });
  if (!decision.ok) throw Object.assign(new Error(decision.error), { status: 400 });
  if (decision.action === 'noop') {
    return { decision, event, promoted: null, position: waitEntry?.position || null };
  }
  if (decision.action === 'remove') {
    if (existing) await tx.communityEventRsvp.delete({ where: { id: existing.id } });
    if (waitEntry) await tx.communityEventWaitlistEntry.delete({ where: { id: waitEntry.id } });
    await resequenceWaitlist(tx, eventId);
    const promoted = decision.promote ? await promoteFirst(tx, event, user.actorId) : null;
    await logEvent(tx, event, 'RSVP', user.actorId || user.userId, { status: 'REMOVED', userId: user.userId });
    return { decision, event, promoted, position: null };
  }
  if (decision.action === 'waitlist') {
    if (decision.clearRsvp && existing) {
      await tx.communityEventRsvp.delete({ where: { id: existing.id } });
    }
    const promoted = decision.promote ? await promoteFirst(tx, event, user.actorId) : null;
    const entries = await tx.communityEventWaitlistEntry.findMany({ where: { eventId } });
    const already = entries.find((entry) => entry.userId === user.userId);
    const position = already ? already.position : nextPosition(entries);
    if (!already) {
      await tx.communityEventWaitlistEntry.create({
        data: {
          eventId,
          guildId,
          userId: user.userId,
          username: user.username,
          displayName: user.displayName || null,
          avatar: user.avatar || null,
          position,
        },
      });
    }
    await logEvent(tx, event, 'WAITLIST', user.actorId || user.userId, { position, userId: user.userId });
    if (event.maxAttendees && goingCount >= event.maxAttendees) {
      await logEvent(tx, event, 'CAPACITY', user.userId, { goingCount });
    }
    return { decision, event, promoted, position };
  }
  await tx.communityEventRsvp.upsert({
    where: { eventId_userId: { eventId, userId: user.userId } },
    create: {
      eventId,
      guildId,
      userId: user.userId,
      username: user.username,
      displayName: user.displayName || null,
      avatar: user.avatar || null,
      status: decision.status,
    },
    update: {
      status: decision.status,
      username: user.username,
      displayName: user.displayName || null,
      avatar: user.avatar || null,
    },
  });
  if (decision.leaveWaitlist && waitEntry) {
    await tx.communityEventWaitlistEntry.delete({ where: { id: waitEntry.id } });
    await resequenceWaitlist(tx, eventId);
  }
  const promoted = decision.promote ? await promoteFirst(tx, event, user.actorId) : null;
  await logEvent(tx, event, 'RSVP', user.actorId || user.userId, { status: decision.status, userId: user.userId });
  return { decision, event, promoted, position: null };
}

async function commitRsvp(prisma, input) {
  const result = await prisma.$transaction(async (tx) => {
    if (typeof tx.$executeRaw === 'function') {
      await tx.$executeRaw`SELECT id FROM "CommunityEvent" WHERE id = ${input.eventId} AND "guildId" = ${input.guildId} FOR UPDATE`;
    }
    return applyLockedRsvp(tx, input);
  });
  return result;
}

async function notifyUser(client, userId, content) {
  try {
    if (client?.users?.fetch) {
      const user = await client.users.fetch(userId);
      await user.send({ content, allowedMentions: { parse: [] } });
      return true;
    }
    const channel = await botFetch('/users/@me/channels', {
      method: 'POST',
      body: JSON.stringify({ recipient_id: userId }),
    });
    await botFetch(`/channels/${channel.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    return true;
  } catch {
    return false;
  }
}

async function syncEventMessageRest(prisma, event) {
  if (!event?.channelId || !event.messageId) return event;
  const counts = await countResponses(prisma, event.id);
  const hash = renderHash(event, counts);
  if (event.messageHash === hash) return event;
  const built = buildEventPayload(event, counts);
  await botFetch(`/channels/${event.channelId}/messages/${event.messageId}`, {
    method: 'PATCH',
    body: JSON.stringify(apiPayload(built)),
  });
  return prisma.communityEvent.update({
    where: { id: event.id },
    data: { messageHash: hash },
  });
}

async function afterRsvp(prisma, client, result) {
  const notify = result.event.notifyConfig || {};
  if (result.promoted && notify.waitlistPromoted !== false) {
    await notifyUser(
      client,
      result.promoted.userId,
      `🎟️ **You're in!**\n\nA spot became available for **${result.event.name}**.\nYou have been moved from the waitlist to Going.`,
    );
  }
  const counts = await countResponses(prisma, result.event.id);
  if (
    result.event.maxAttendees &&
    counts.going >= result.event.maxAttendees &&
    !result.event.capacityNotifiedAt &&
    notify.capacityReached !== false &&
    client &&
    result.event.channelId
  ) {
    const channel = await client.channels.fetch(result.event.channelId).catch(() => null);
    await channel?.send({
      content: `🎟️ **${result.event.name}** is now full.`,
      allowedMentions: { parse: [] },
    }).catch(() => {});
    await prisma.communityEvent.update({
      where: { id: result.event.id },
      data: { capacityNotifiedAt: new Date() },
    });
  }
  scheduleMessageSync(client, result.event.id);
  return { ...result, counts };
}

async function replaceReminders(prisma, event) {
  await prisma.communityEventReminder.deleteMany({
    where: { eventId: event.id, status: 'PENDING' },
  });
  const now = new Date();
  const rows = asArray(event.reminderConfig).map((reminder) => ({
    eventId: event.id,
    guildId: event.guildId,
    offsetMinutes: reminder.offsetMinutes,
    targets: reminder.targets,
    includeTentative: reminder.includeTentative === true,
    runAt: reminderRunAt(event.startAt, reminder.offsetMinutes),
    status: reminderRunAt(event.startAt, reminder.offsetMinutes) <= now ? 'SKIPPED' : 'PENDING',
  }));
  if (rows.length) await prisma.communityEventReminder.createMany({ data: rows });
}

function eventData(input, extra = {}) {
  return {
    name: input.name,
    description: input.description,
    startAt: input.startAt,
    endAt: input.endAt,
    timezone: input.timezone,
    location: input.location,
    channelId: input.channelId,
    imageUrl: input.imageUrl,
    color: input.color,
    organizerId: input.organizerId,
    maxAttendees: input.maxAttendees,
    rsvpEnabled: input.rsvpEnabled,
    threadEnabled: input.threadEnabled,
    archiveThread: input.archiveThread,
    reminderConfig: input.reminderConfig,
    roleIds: input.roleIds,
    roleMode: input.roleMode,
    embed: input.embed,
    notifyConfig: input.notifyConfig,
    kind: input.kind,
    ...extra,
  };
}

async function createEventRecord(prisma, guildId, input, extra = {}) {
  if (!input.organizerId) throw inputError('An organizer is required.');
  const scheduled = input.publishAt && input.publishAt > new Date();
  return prisma.communityEvent.create({
    data: eventData(input, {
      guildId,
      status: scheduled ? 'SCHEDULED' : 'DRAFT',
      publishAt: scheduled ? input.publishAt : null,
      templateId: extra.templateId || null,
      seriesId: extra.seriesId || null,
      createdBy: extra.createdBy || input.organizerId,
    }),
  });
}

async function publishEvent(prisma, client, { guildId, eventId, actorId }) {
  const event = await prisma.communityEvent.findFirst({ where: { id: eventId, guildId } });
  if (!event) throw Object.assign(new Error('Event not found.'), { status: 404 });
  if (event.cancelledAt) throw inputError('Cancelled events cannot be published.');
  if (event.publishedAt) return event;
  if (!event.channelId) throw inputError('Choose a channel before publishing.');
  const counts = await countResponses(prisma, event.id);
  const built = buildEventPayload(event, counts);
  let message;
  if (client) {
    const channel = await client.channels.fetch(event.channelId);
    message = await channel.send(built);
  } else {
    message = await botFetch(`/channels/${event.channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify(apiPayload(built)),
    });
  }
  let threadId = event.threadId;
  if (event.threadEnabled && !threadId) {
    if (client && message.startThread) {
      threadId = await createDiscussionThread(message, event).catch((error) => {
        console.error(`Event thread failed for ${event.id}:`, error.message);
        return null;
      });
    } else {
      const thread = await botFetch(`/channels/${event.channelId}/messages/${message.id}/threads`, {
        method: 'POST',
        body: JSON.stringify({ name: event.name.slice(0, 100), auto_archive_duration: 1440 }),
      }).catch((error) => {
        console.error(`Event thread failed for ${event.id}:`, error.message);
        return null;
      });
      threadId = thread?.id || null;
    }
  }
  const published = await prisma.communityEvent.update({
    where: { id: event.id },
    data: {
      publishedAt: new Date(),
      messageId: message.id,
      threadId,
      status: 'UPCOMING',
    },
  });
  await replaceReminders(prisma, published);
  await logEvent(prisma, published, 'PUBLISHED', actorId, { messageId: message.id, threadId });
  await refreshEventMessage(client, published.id);
  return published;
}

async function createSeries(prisma, guildId, input, actorId) {
  return prisma.communityEventSeries.create({
    data: {
      guildId,
      name: input.name,
      description: input.description,
      timezone: input.timezone,
      recurrence: input.recurrence,
      interval: input.interval,
      weekdays: input.weekdays,
      anchorStart: input.startAt,
      durationMinutes: input.durationMinutes,
      location: input.location,
      channelId: input.channelId,
      imageUrl: input.imageUrl,
      color: input.color,
      organizerId: input.organizerId,
      maxAttendees: input.maxAttendees,
      rsvpEnabled: input.rsvpEnabled,
      threadEnabled: input.threadEnabled,
      roleIds: input.roleIds,
      roleMode: input.roleMode,
      reminderConfig: input.reminderConfig,
      embed: input.embed,
      notifyConfig: input.notifyConfig,
      kind: input.kind,
      createdBy: actorId,
    },
  });
}

async function materializeSeries(prisma, client, series, actorId) {
  const existing = await prisma.communityEvent.findMany({
    where: { seriesId: series.id },
    select: { startAt: true },
  });
  const planned = planSeriesInstances(series, existing.map((event) => event.startAt));
  const created = [];
  for (const startAt of planned) {
    const endAt = new Date(startAt.getTime() + series.durationMinutes * 60_000);
    const publishAt = new Date(startAt.getTime() - series.publishLeadMinutes * 60_000);
    const event = await createEventRecord(prisma, series.guildId, {
      ...series,
      startAt,
      endAt,
      publishAt,
      durationMinutes: series.durationMinutes,
      organizerId: series.organizerId,
      publishNow: false,
    }, { seriesId: series.id, createdBy: actorId });
    created.push(event);
    if (publishAt <= new Date()) {
      await publishEvent(prisma, client, { guildId: series.guildId, eventId: event.id, actorId }).catch((error) => {
        console.error(`Recurring event publish failed for ${event.id}:`, error.message);
      });
    }
  }
  return created;
}

async function createEvent(prisma, client, { guildId, guildName, actorId, body }) {
  const input = normalizeEventInput(body, { actorId });
  await ensureServer(prisma, guildId, guildName);
  let series = null;
  if (input.recurrence !== 'NONE') {
    series = await createSeries(prisma, guildId, input, actorId);
  }
  const event = await createEventRecord(prisma, guildId, input, {
    seriesId: series?.id,
    templateId: body.templateId || null,
    createdBy: actorId,
  });
  await logEvent(prisma, event, 'CREATED', actorId, { seriesId: series?.id || null });
  let published = event;
  if (input.publishNow) {
    published = await publishEvent(prisma, client, { guildId, eventId: event.id, actorId });
  }
  if (series) await materializeSeries(prisma, client, series, actorId);
  return published;
}

async function updateEvent(prisma, client, { guildId, eventId, actorId, body }) {
  const existing = await prisma.communityEvent.findFirst({ where: { id: eventId, guildId } });
  if (!existing) throw Object.assign(new Error('Event not found.'), { status: 404 });
  if (existing.cancelledAt) throw inputError('Cancelled events cannot be edited. Duplicate it instead.');
  const input = normalizeEventInput({
    ...existing,
    ...body,
    organizerId: body.organizerId || existing.organizerId,
    startAt: body.date ? undefined : (body.startAt || existing.startAt),
    endAt: body.endDate ? undefined : (body.endAt || existing.endAt),
    publishAt: body.publishDate ? undefined : (body.publishAt || null),
  }, { actorId: existing.organizerId });
  const startChanged = new Date(input.startAt).getTime() !== new Date(existing.startAt).getTime()
    || (existing.endAt && input.endAt && new Date(input.endAt).getTime() !== new Date(existing.endAt).getTime());
  const data = eventData(input, body.scope === 'one' && existing.seriesId ? { seriesDetached: true } : {});
  const updated = await prisma.communityEvent.update({ where: { id: existing.id }, data });
  await logEvent(prisma, updated, startChanged ? 'RESCHEDULED' : 'EDITED', actorId, {
    startAt: updated.startAt,
    endAt: updated.endAt,
  });
  if (updated.publishedAt) await replaceReminders(prisma, updated);
  if (body.scope === 'series' && existing.seriesId) {
    await prisma.communityEventSeries.update({
      where: { id: existing.seriesId },
      data: {
        name: input.name,
        description: input.description,
        location: input.location,
        channelId: input.channelId,
        color: input.color,
        maxAttendees: input.maxAttendees,
        reminderConfig: input.reminderConfig,
        roleIds: input.roleIds,
        roleMode: input.roleMode,
        threadEnabled: input.threadEnabled,
        kind: input.kind,
      },
    });
    await prisma.communityEvent.updateMany({
      where: {
        seriesId: existing.seriesId,
        seriesDetached: false,
        startAt: { gt: new Date() },
        id: { not: existing.id },
        cancelledAt: null,
      },
      data: {
        name: input.name,
        description: input.description,
        location: input.location,
        channelId: input.channelId,
        color: input.color,
        maxAttendees: input.maxAttendees,
        reminderConfig: input.reminderConfig,
        roleIds: input.roleIds,
        roleMode: input.roleMode,
        threadEnabled: input.threadEnabled,
        kind: input.kind,
      },
    });
  }
  if (startChanged && updated.publishedAt && updated.notifyConfig?.rescheduled !== false) {
    const people = await prisma.communityEventRsvp.findMany({
      where: { eventId: updated.id, status: { in: ['GOING', 'TENTATIVE'] } },
    });
    await Promise.all(people.map((person) => notifyUser(
      client,
      person.userId,
      `📅 **${updated.name}** was rescheduled.\nNew time: <t:${Math.floor(new Date(updated.startAt).getTime() / 1000)}:F>`,
    )));
  }
  if (client) scheduleMessageSync(client, updated.id);
  else await syncEventMessageRest(prisma, updated).catch((error) => {
    console.error(`Event message update failed for ${updated.id}:`, error.message);
  });
  return updated;
}

async function cancelEvent(prisma, client, { guildId, eventId, actorId, scope }) {
  const event = await prisma.communityEvent.findFirst({ where: { id: eventId, guildId } });
  if (!event) throw Object.assign(new Error('Event not found.'), { status: 404 });
  const targets = scope === 'series' && event.seriesId
    ? await prisma.communityEvent.findMany({
        where: { guildId, seriesId: event.seriesId, cancelledAt: null, startAt: { gte: event.startAt } },
      })
    : [event];
  if (scope === 'series' && event.seriesId) {
    await prisma.communityEventSeries.update({ where: { id: event.seriesId }, data: { enabled: false } });
  }
  for (const target of targets) {
    const cancelled = await prisma.communityEvent.update({
      where: { id: target.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), rsvpEnabled: false },
    });
    await prisma.communityEventReminder.updateMany({
      where: { eventId: target.id, status: 'PENDING' },
      data: { status: 'SKIPPED' },
    });
    await logEvent(prisma, cancelled, 'CANCELLED', actorId, { scope: scope || 'one' });
    if (cancelled.notifyConfig?.cancelled !== false) {
      const people = await prisma.communityEventRsvp.findMany({
        where: { eventId: cancelled.id, status: { in: ['GOING', 'TENTATIVE'] } },
      });
      await Promise.all(people.map((person) => notifyUser(
        client,
        person.userId,
        `**${cancelled.name}** was cancelled.`,
      )));
    }
    if (client) {
      await archiveEventThread(client, cancelled);
      scheduleMessageSync(client, cancelled.id);
    } else {
      if (cancelled.threadId && cancelled.archiveThread !== false) {
        await botFetch(`/channels/${cancelled.threadId}`, {
          method: 'PATCH',
          body: JSON.stringify({ locked: true, archived: true }),
        }).catch(() => {});
      }
      await syncEventMessageRest(prisma, cancelled).catch(() => {});
    }
  }
  return targets.length;
}

async function endEvent(prisma, client, { guildId, eventId, actorId }) {
  const event = await prisma.communityEvent.findFirst({ where: { id: eventId, guildId } });
  if (!event) throw Object.assign(new Error('Event not found.'), { status: 404 });
  const ended = await prisma.communityEvent.update({
    where: { id: event.id },
    data: { status: 'ENDED', endedAt: new Date(), rsvpEnabled: false },
  });
  await prisma.communityEventReminder.updateMany({
    where: { eventId: event.id, status: 'PENDING' },
    data: { status: 'SKIPPED' },
  });
  await logEvent(prisma, ended, 'ENDED', actorId, {});
  if (client) {
    await archiveEventThread(client, ended);
    scheduleMessageSync(client, ended.id);
  } else {
    if (ended.threadId && ended.archiveThread !== false) {
      await botFetch(`/channels/${ended.threadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ locked: true, archived: true }),
      }).catch(() => {});
    }
    await syncEventMessageRest(prisma, ended).catch(() => {});
  }
  return ended;
}

async function duplicateEvent(prisma, { guildId, eventId, actorId }) {
  const event = await prisma.communityEvent.findFirst({ where: { id: eventId, guildId } });
  if (!event) throw Object.assign(new Error('Event not found.'), { status: 404 });
  const copy = await createEventRecord(prisma, guildId, duplicateInput(event), { createdBy: actorId });
  await logEvent(prisma, copy, 'DUPLICATED', actorId, { sourceId: event.id });
  return copy;
}

async function deleteEvent(prisma, { guildId, eventId }) {
  const event = await prisma.communityEvent.findFirst({ where: { id: eventId, guildId } });
  if (!event) throw Object.assign(new Error('Event not found.'), { status: 404 });
  await prisma.communityEvent.delete({ where: { id: event.id } });
  return { deleted: true };
}

async function saveTemplate(prisma, { guildId, actorId, body }) {
  const input = normalizeEventInput(body, { actorId });
  const name = String(body.templateName || input.name).trim().slice(0, 80);
  if (!name) throw inputError('Template name is required.');
  return prisma.communityEventTemplate.upsert({
    where: { guildId_name: { guildId, name } },
    create: { guildId, name, payload: input, createdBy: actorId },
    update: { payload: input },
  });
}

async function listEvents(prisma, guildId, { bucket, page, query, month }) {
  const events = await prisma.communityEvent.findMany({
    where: {
      guildId,
      ...(query ? { name: { contains: query, mode: 'insensitive' } } : {}),
    },
    orderBy: { startAt: 'asc' },
    take: 500,
  });
  const ids = events.map((event) => event.id);
  const grouped = ids.length
    ? await prisma.communityEventRsvp.groupBy({
        by: ['eventId', 'status'],
        where: { eventId: { in: ids } },
        _count: { _all: true },
      })
    : [];
  const waits = ids.length
    ? await prisma.communityEventWaitlistEntry.groupBy({
        by: ['eventId'],
        where: { eventId: { in: ids } },
        _count: { _all: true },
      })
    : [];
  const countMap = new Map();
  for (const event of events) countMap.set(event.id, { going: 0, tentative: 0, declined: 0, waitlist: 0 });
  for (const row of grouped) {
    const counts = countMap.get(row.eventId);
    const key = String(row.status || '').toLowerCase();
    if (counts && key in counts) counts[key] = row._count._all;
  }
  for (const row of waits) {
    const counts = countMap.get(row.eventId);
    if (counts) counts.waitlist = row._count._all;
  }
  const decorated = events.map((event) => publicEvent(event, countMap.get(event.id)));
  const filtered = bucket === 'calendar'
    ? decorated.filter((event) => !month || dateInMonth(event, month))
    : decorated.filter((event) => matchesBucket(event, bucket));
  const calendar = bucket === 'calendar' ? filtered : [];
  const ordered = filtered.sort((left, right) => {
    const descending = bucket === 'past' || bucket === 'cancelled';
    const delta = new Date(left.startAt) - new Date(right.startAt);
    return descending ? -delta : delta;
  });
  const rsvps = [];
  for (const event of decorated) {
    for (let index = 0; index < event.counts.going; index += 1) rsvps.push({ status: 'GOING' });
    for (let index = 0; index < event.counts.tentative; index += 1) rsvps.push({ status: 'TENTATIVE' });
    for (let index = 0; index < event.counts.declined; index += 1) rsvps.push({ status: 'DECLINED' });
  }
  const stats = buildStats(
    decorated.map((event) => ({ ...event, going: event.counts.going })),
    rsvps,
    decorated.reduce((sum, event) => sum + event.counts.waitlist, 0),
  );
  const counts = decorated.reduce((summary, event) => {
    summary[event.status] = (summary[event.status] || 0) + 1;
    return summary;
  }, {});
  return { ...paginate(ordered, page), counts, stats, calendar };
}

function dateInMonth(event, month) {
  const zone = event.timezone || 'UTC';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
  }).format(new Date(event.startAt));
  return parts.slice(0, 7) === month;
}

async function getEvent(prisma, guildId, eventId) {
  const event = await prisma.communityEvent.findFirst({
    where: { id: Number(eventId), guildId },
    include: {
      rsvps: { orderBy: { updatedAt: 'desc' } },
      waitlist: { orderBy: { position: 'asc' } },
      reminders: { orderBy: { runAt: 'asc' } },
      logs: { orderBy: { createdAt: 'desc' }, take: 50 },
      series: true,
    },
  });
  if (!event) return null;
  const counts = {
    going: event.rsvps.filter((rsvp) => rsvp.status === 'GOING').length,
    tentative: event.rsvps.filter((rsvp) => rsvp.status === 'TENTATIVE').length,
    declined: event.rsvps.filter((rsvp) => rsvp.status === 'DECLINED').length,
    waitlist: event.waitlist.length,
  };
  const { rsvps, waitlist, reminders, logs, series, ...rest } = event;
  return {
    ...publicEvent(rest, counts),
    attendees: {
      going: rsvps.filter((rsvp) => rsvp.status === 'GOING').map(publicPerson),
      tentative: rsvps.filter((rsvp) => rsvp.status === 'TENTATIVE').map(publicPerson),
      declined: rsvps.filter((rsvp) => rsvp.status === 'DECLINED').map(publicPerson),
      waitlist: waitlist.map(publicPerson),
    },
    reminders,
    logs,
    series,
  };
}

async function resolveMember(guildId, userId) {
  const member = await botFetch(`/guilds/${guildId}/members/${userId}`);
  return {
    userId,
    username: member.user.username,
    displayName: member.nick || member.user.global_name || member.user.username,
    avatar: member.user.avatar || null,
    roleIds: member.roles || [],
  };
}

async function setAttendee(prisma, client, { guildId, eventId, actorId, userId, status }) {
  const member = await resolveMember(guildId, userId);
  const result = await commitRsvp(prisma, {
    guildId,
    eventId,
    requested: status,
    skipEligibility: true,
    user: { ...member, actorId },
  });
  return afterRsvp(prisma, client, result);
}

async function respondToEvent(prisma, client, { guildId, eventId, user, requested }) {
  const result = await commitRsvp(prisma, { guildId, eventId, user, requested });
  return afterRsvp(prisma, client, result);
}

async function deliverReminder(prisma, client, reminder) {
  const event = reminder.event;
  const statuses = reminder.includeTentative ? ['GOING', 'TENTATIVE'] : ['GOING'];
  const people = await prisma.communityEventRsvp.findMany({
    where: { eventId: event.id, status: { in: statuses } },
  });
  const targets = asArray(reminder.targets);
  const errors = [];
  const unix = Math.floor(new Date(event.startAt).getTime() / 1000);
  const content = `⏳ **${event.name}** starts <t:${unix}:R>.`;
  const mentions = people.slice(0, 20);
  if (targets.includes('CHANNEL') && event.channelId) {
    const body = {
      content: `${content}\n${mentions.map((person) => `<@${person.userId}>`).join(' ')}`.trim(),
      allowed_mentions: { parse: [], users: mentions.map((person) => person.userId) },
    };
    if (client?.channels?.fetch) {
      const channel = await client.channels.fetch(event.channelId).catch(() => null);
      await channel?.send({
        content: body.content,
        allowedMentions: { parse: [], users: body.allowed_mentions.users },
      }).catch((error) => errors.push(error.message));
    } else {
      await botFetch(`/channels/${event.channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify(body),
      }).catch((error) => errors.push(error.message));
    }
  }
  if (targets.includes('THREAD') && event.threadId) {
    if (client?.channels?.fetch) {
      const thread = await client.channels.fetch(event.threadId).catch(() => null);
      await thread?.send({ content, allowedMentions: { parse: [] } }).catch((error) => errors.push(error.message));
    } else {
      await botFetch(`/channels/${event.threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      }).catch((error) => errors.push(error.message));
    }
  }
  if (targets.includes('DM')) {
    for (const person of people) {
      const sent = await notifyUser(client, person.userId, `${content}\nYou are marked as ${person.status.toLowerCase()}.`);
      if (!sent) errors.push(person.userId);
    }
  }
  await prisma.communityEventReminder.update({
    where: { id: reminder.id },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      error: errors.length ? errors.slice(0, 8).join(', ').slice(0, 500) : null,
    },
  });
  await logEvent(prisma, event, 'REMINDER', null, { offsetMinutes: reminder.offsetMinutes, failures: errors.length });
}

async function sendReminderNow(prisma, client, { guildId, eventId, actorId }) {
  const event = await prisma.communityEvent.findFirst({ where: { id: eventId, guildId } });
  if (!event) throw Object.assign(new Error('Event not found.'), { status: 404 });
  const reminder = await prisma.communityEventReminder.create({
    data: {
      eventId: event.id,
      guildId,
      offsetMinutes: 0,
      targets: ['DM', 'CHANNEL'],
      includeTentative: false,
      runAt: new Date(),
      status: 'SENDING',
    },
  });
  await deliverReminder(prisma, client, { ...reminder, event });
  await logEvent(prisma, event, 'REMINDER', actorId, { manual: true });
  return { sent: true };
}

async function runEventMaintenance(client) {
  const prisma = client.prisma;
  const now = new Date();
  const due = await prisma.communityEvent.findMany({
    where: {
      publishedAt: null,
      publishAt: { lte: now },
      cancelledAt: null,
      channelId: { not: null },
    },
    take: 10,
  });
  for (const event of due) {
    await publishEvent(prisma, client, { guildId: event.guildId, eventId: event.id, actorId: event.createdBy })
      .catch((error) => console.error(`Scheduled event ${event.id} failed:`, error.message));
  }
  const reminders = await prisma.communityEventReminder.findMany({
    where: { status: 'PENDING', runAt: { lte: now } },
    include: { event: true },
    take: 20,
    orderBy: { runAt: 'asc' },
  });
  for (const reminder of reminders) {
    const claimed = await prisma.communityEventReminder.updateMany({
      where: { id: reminder.id, status: 'PENDING' },
      data: { status: 'SENDING' },
    });
    if (!claimed.count) continue;
    await deliverReminder(prisma, client, reminder).catch(async (error) => {
      await prisma.communityEventReminder.update({
        where: { id: reminder.id },
        data: { status: 'FAILED', error: error.message.slice(0, 500) },
      });
    });
  }
  const series = await prisma.communityEventSeries.findMany({ where: { enabled: true }, take: 20 });
  for (const item of series) {
    await materializeSeries(prisma, client, item, item.createdBy).catch((error) => {
      console.error(`Event series ${item.id} failed:`, error.message);
    });
  }
  const boundaries = await prisma.communityEvent.findMany({
    where: {
      publishedAt: { not: null },
      messageId: { not: null },
      OR: [
        { startAt: { lte: now, gte: new Date(now.getTime() - 10 * 60_000) } },
        { endAt: { lte: now, gte: new Date(now.getTime() - 10 * 60_000) } },
      ],
    },
    take: 20,
  });
  for (const event of boundaries) {
    await refreshEventMessage(client, event.id).catch(() => {});
  }
}

module.exports = {
  afterRsvp,
  applyLockedRsvp,
  cancelEvent,
  commitRsvp,
  createEvent,
  deleteEvent,
  deliverReminder,
  duplicateEvent,
  endEvent,
  getEvent,
  listEvents,
  materializeSeries,
  publicPerson,
  publishEvent,
  respondToEvent,
  runEventMaintenance,
  saveTemplate,
  sendReminderNow,
  setAttendee,
  updateEvent,
};
