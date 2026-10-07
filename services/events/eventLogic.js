const { MELLUNE_DEFAULT_EMBED_COLOR } = require('../../lib/constants');

const TIMEZONES = [
  'UTC',
  'Europe/Paris',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];
const SERIES_WINDOW = 4;
const HORIZON_MS = 60 * 24 * 60 * 60 * 1000;
const SNOWFLAKE = /^\d{15,25}$/;

function inputError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function timeZoneOffset(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) % 24,
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

function zonedToUtc(parts, timeZone) {
  const utcGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0));
  const corrected = new Date(utcGuess.getTime() - timeZoneOffset(utcGuess, timeZone));
  return new Date(utcGuess.getTime() - timeZoneOffset(corrected, timeZone));
}

function utcParts(date, timeZone) {
  const safeZone = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone,
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    weekday: weekdays[map.weekday] ?? 0,
  };
}

function addDays(parts, days) {
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    ...parts,
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function parseWallClock(date, time, timeZone) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(String(time || ''));
  if (!dateMatch || !timeMatch) throw inputError('Choose a valid date and time.');
  if (!isValidTimeZone(timeZone)) throw inputError('Choose a valid timezone.');
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour > 23 || minute > 59) throw inputError('Choose a valid date and time.');
  return zonedToUtc(
    {
      year: Number(dateMatch[1]),
      month: Number(dateMatch[2]),
      day: Number(dateMatch[3]),
      hour,
      minute,
    },
    timeZone,
  );
}

function wallFields(value, timeZone) {
  const parts = utcParts(new Date(value), timeZone);
  return {
    date: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
    time: `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`,
  };
}

function dateKey(value, timeZone) {
  const parts = utcParts(new Date(value), timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function cleanUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString().slice(0, 400) : null;
  } catch {
    return null;
  }
}

const DATA_IMAGE = /^data:image\/(png|jpe?g|webp|gif);base64,/i;
const MAX_EVENT_IMAGE_CHARS = 3_500_000;

function cleanImageSource(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (DATA_IMAGE.test(trimmed)) {
    if (trimmed.length > MAX_EVENT_IMAGE_CHARS) {
      throw inputError('Choose an image under 2 MB.');
    }
    return trimmed;
  }
  return cleanUrl(trimmed);
}

function snowflake(value) {
  const cleaned = String(value || '').trim();
  return SNOWFLAKE.test(cleaned) ? cleaned : null;
}

function snowflakeList(value) {
  return [...new Set(asArray(value).map(snowflake).filter(Boolean))].slice(0, 10);
}

function effectiveStatus(event, now = new Date()) {
  if (!event || event.status === 'CANCELLED' || event.cancelledAt) return 'CANCELLED';
  if (!event.publishedAt) {
    if (event.publishAt && new Date(event.publishAt) > now) return 'SCHEDULED';
    return 'DRAFT';
  }
  if (event.endedAt || (event.endAt && new Date(event.endAt) <= now)) return 'ENDED';
  if (new Date(event.startAt) <= now) return 'LIVE';
  return 'UPCOMING';
}

const STATUS_LABELS = {
  DRAFT: 'Not posted',
  SCHEDULED: 'Posts later',
  UPCOMING: 'Coming up',
  LIVE: 'Happening now',
  ENDED: 'Finished',
  CANCELLED: 'Cancelled',
};

function statusLabel(status) {
  return STATUS_LABELS[status] || 'Coming up';
}

function matchesBucket(event, bucket, now = new Date()) {
  const status = effectiveStatus(event, now);
  if (!bucket || bucket === 'all' || bucket === 'calendar') return true;
  if (bucket === 'coming') return status === 'UPCOMING' || status === 'DRAFT' || status === 'SCHEDULED';
  const buckets = {
    upcoming: 'UPCOMING',
    live: 'LIVE',
    past: 'ENDED',
    drafts: 'DRAFT',
    scheduled: 'SCHEDULED',
    cancelled: 'CANCELLED',
  };
  return status === buckets[bucket];
}

function isEligible(event, roleIds = []) {
  const required = snowflakeList(event.roleIds);
  if (!required.length) return true;
  const owned = new Set(roleIds);
  if (event.roleMode === 'ALL') return required.every((roleId) => owned.has(roleId));
  return required.some((roleId) => owned.has(roleId));
}

function decideRsvp({
  event,
  now = new Date(),
  memberRoleIds = [],
  existingStatus = null,
  waitlisted = false,
  goingCount = 0,
  requested,
  skipEligibility = false,
}) {
  if (requested === 'REMOVE') {
    if (!existingStatus && !waitlisted) return { ok: true, action: 'noop' };
    return { ok: true, action: 'remove', promote: existingStatus === 'GOING' };
  }
  const status = effectiveStatus(event, now);
  if (!event.rsvpEnabled || ['DRAFT', 'SCHEDULED', 'ENDED', 'CANCELLED'].includes(status)) {
    return { ok: false, error: 'RSVP is closed for this event.' };
  }
  if (!['GOING', 'TENTATIVE', 'DECLINED', 'WAITLIST'].includes(requested)) {
    return { ok: false, error: 'Choose Going, Tentative or Declined.' };
  }
  if (!skipEligibility && !isEligible(event, memberRoleIds)) {
    return { ok: false, error: 'You need the required role to RSVP.' };
  }
  if (requested === 'TENTATIVE' || requested === 'DECLINED') {
    if (existingStatus === requested && !waitlisted) return { ok: true, action: 'noop' };
    return {
      ok: true,
      action: 'set',
      status: requested,
      promote: existingStatus === 'GOING',
      leaveWaitlist: true,
    };
  }
  if (requested === 'WAITLIST' || (
    requested === 'GOING' &&
    event.maxAttendees &&
    existingStatus !== 'GOING' &&
    goingCount >= event.maxAttendees
  )) {
    if (waitlisted && existingStatus !== 'GOING') return { ok: true, action: 'noop' };
    return {
      ok: true,
      action: 'waitlist',
      promote: existingStatus === 'GOING',
      clearRsvp: true,
    };
  }
  if (existingStatus === 'GOING' && !waitlisted) return { ok: true, action: 'noop' };
  return { ok: true, action: 'set', status: 'GOING', leaveWaitlist: true, promote: false };
}

function nextPosition(entries) {
  return entries.reduce((max, entry) => Math.max(max, Number(entry.position) || 0), 0) + 1;
}

function resequence(entries) {
  return [...entries]
    .sort((a, b) => a.position - b.position || new Date(a.createdAt) - new Date(b.createdAt))
    .map((entry, index) => ({ ...entry, position: index + 1 }));
}

const AUTOMATIC_REMINDERS = [
  { offsetMinutes: 15, targets: ['DM'], includeTentative: false },
  { offsetMinutes: 0, targets: ['DM'], includeTentative: false },
];

function normalizeReminders(input) {
  const source = asArray(input);
  return (source.length ? source : AUTOMATIC_REMINDERS).slice(0, 8).map((item) => {
    const rawOffset = Number(item.offsetMinutes);
    const offsetMinutes = Number.isFinite(rawOffset)
      ? Math.min(60 * 24 * 30, Math.max(0, rawOffset))
      : -1;
    const targets = [...new Set(asArray(item.targets).filter((target) => ['DM', 'CHANNEL', 'THREAD'].includes(target)))];
    return {
      offsetMinutes,
      targets: targets.length ? targets : ['DM'],
      includeTentative: item.includeTentative === true,
    };
  }).filter((item) => item.offsetMinutes >= 0);
}

function reminderRunAt(startAt, offsetMinutes) {
  return new Date(new Date(startAt).getTime() - offsetMinutes * 60_000);
}

function defaultNotify(input = {}) {
  return {
    published: input.published === true,
    cancelled: input.cancelled !== false,
    rescheduled: input.rescheduled !== false,
    waitlistPromoted: input.waitlistPromoted !== false,
    capacityReached: input.capacityReached !== false,
  };
}

function normalizeEventInput(body = {}, { actorId } = {}) {
  const name = String(body.name || '').trim().slice(0, 120);
  if (!name) throw inputError('Event name is required.');
  const timezone = isValidTimeZone(body.timezone) ? body.timezone : 'UTC';
  const startAt = body.startAt ? new Date(body.startAt) : parseWallClock(body.date, body.time, timezone);
  if (Number.isNaN(startAt.getTime())) throw inputError('Choose a valid start time.');
  const durationMinutes = Math.min(10080, Math.max(15, Number(body.durationMinutes) || 120));
  let endAt = null;
  if (body.endDate && body.endTime) endAt = parseWallClock(body.endDate, body.endTime, timezone);
  else if (body.endAt) endAt = new Date(body.endAt);
  else endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
  if (Number.isNaN(endAt.getTime()) || endAt <= startAt) throw inputError('End time must be after the start time.');
  let publishAt = null;
  if (body.publishDate && body.publishTime) publishAt = parseWallClock(body.publishDate, body.publishTime, timezone);
  else if (body.publishAt) publishAt = new Date(body.publishAt);
  if (publishAt && Number.isNaN(publishAt.getTime())) throw inputError('Choose a valid publish time.');
  const maxRaw = body.maxAttendees;
  const maxAttendees = maxRaw == null || maxRaw === '' || Number(maxRaw) === 0
    ? null
    : Math.min(5000, Math.max(1, Number(maxRaw) || 0));
  const recurrence = ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM'].includes(body.recurrence)
    ? body.recurrence
    : 'NONE';
  const color = /^#[0-9a-fA-F]{6}$/.test(body.color || '') ? body.color : MELLUNE_DEFAULT_EMBED_COLOR;
  const embed = body.embed && (body.embed.title || body.embed.description)
    ? {
        title: String(body.embed.title || '').trim().slice(0, 256) || null,
        description: String(body.embed.description || '').trim().slice(0, 2000) || null,
      }
    : null;
  return {
    name,
    description: String(body.description || '').trim().slice(0, 2000),
    startAt,
    endAt,
    timezone,
    location: String(body.location || '').trim().slice(0, 120) || null,
    channelId: snowflake(body.channelId),
    imageUrl: cleanImageSource(body.imageUrl),
    color,
    organizerId: snowflake(body.organizerId) || actorId || null,
    maxAttendees,
    rsvpEnabled: body.rsvpEnabled !== false,
    threadEnabled: body.threadEnabled === true,
    archiveThread: body.archiveThread !== false,
    roleIds: snowflakeList(body.roleIds),
    roleMode: body.roleMode === 'ALL' ? 'ALL' : 'ANY',
    reminderConfig: normalizeReminders(body.reminders || body.reminderConfig),
    embed,
    notifyConfig: defaultNotify(body.notifyConfig || body.notify || {}),
    kind: String(body.kind || 'General').trim().slice(0, 40) || 'General',
    recurrence,
    interval: Math.min(12, Math.max(1, Number(body.interval) || 1)),
    weekdays: [...new Set(asArray(body.weekdays).map(Number).filter((day) => day >= 0 && day <= 6))],
    publishAt,
    durationMinutes,
    publishNow: body.publish === true && !(publishAt && publishAt > new Date()),
  };
}

function duplicateInput(event) {
  return {
    ...normalizeEventInput({
      ...event,
      startAt: event.startAt,
      endAt: event.endAt,
      publish: false,
      publishAt: null,
    }),
    name: `Copy of ${event.name}`.slice(0, 120),
    publishNow: false,
    publishAt: null,
  };
}

function nextOccurrence(startAt, series) {
  const timeZone = isValidTimeZone(series.timezone) ? series.timezone : 'UTC';
  const parts = utcParts(new Date(startAt), timeZone);
  const interval = Math.max(1, Number(series.interval) || 1);
  if (series.recurrence === 'DAILY') return zonedToUtc(addDays(parts, interval), timeZone);
  if (series.recurrence === 'WEEKLY') return zonedToUtc(addDays(parts, 7 * interval), timeZone);
  if (series.recurrence === 'BIWEEKLY') return zonedToUtc(addDays(parts, 14), timeZone);
  if (series.recurrence === 'MONTHLY') {
    const monthIndex = parts.month - 1 + interval;
    const year = parts.year + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    const day = Math.min(parts.day, new Date(Date.UTC(year, month, 0)).getUTCDate());
    return zonedToUtc({ ...parts, year, month, day }, timeZone);
  }
  const allowed = new Set(asArray(series.weekdays).map(Number).filter((day) => day >= 0 && day <= 6));
  if (!allowed.size) allowed.add(parts.weekday);
  for (let step = 1; step <= 21; step += 1) {
    const probe = zonedToUtc(addDays(parts, step), timeZone);
    if (allowed.has(utcParts(probe, timeZone).weekday)) return probe;
  }
  return zonedToUtc(addDays(parts, 7), timeZone);
}

function planSeriesInstances(series, existingStarts, now = new Date()) {
  if (!series?.enabled || !series.recurrence || series.recurrence === 'NONE') return [];
  const existing = new Set(existingStarts.map((value) => new Date(value).toISOString()));
  const planned = [];
  let cursor = new Date(series.anchorStart);
  let guard = 0;
  while (cursor < now && guard < 400) {
    cursor = nextOccurrence(cursor, series);
    guard += 1;
  }
  const horizon = now.getTime() + HORIZON_MS;
  while (planned.length < SERIES_WINDOW && cursor.getTime() <= horizon && guard < 500) {
    if (!existing.has(cursor.toISOString())) planned.push(new Date(cursor));
    cursor = nextOccurrence(cursor, series);
    guard += 1;
  }
  return planned;
}

function renderHash(event, counts) {
  return JSON.stringify({
    name: event.name,
    description: event.description,
    startAt: new Date(event.startAt).toISOString(),
    endAt: event.endAt ? new Date(event.endAt).toISOString() : null,
    location: event.location,
    channelId: event.channelId,
    color: event.color,
    status: effectiveStatus(event),
    max: event.maxAttendees,
    image: event.imageUrl,
    rsvp: event.rsvpEnabled,
    counts,
  });
}

function formatEventWhen(event) {
  const timeZone = isValidTimeZone(event.timezone) ? event.timezone : 'UTC';
  const start = new Date(event.startAt);
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(start);
  const clock = {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  };
  return {
    date,
    time: new Intl.DateTimeFormat('en-US', clock).format(start),
    end: event.endAt ? new Intl.DateTimeFormat('en-US', clock).format(new Date(event.endAt)) : null,
    timeZone,
  };
}

function buildStats(events, rsvps, waitlistCount) {
  const visible = events.map((event) => ({ ...event, effective: effectiveStatus(event) }));
  const ended = visible.filter((event) => event.effective === 'ENDED');
  const cancelled = visible.filter((event) => event.effective === 'CANCELLED');
  const withCapacity = visible.filter((event) => event.maxAttendees);
  const going = rsvps.filter((rsvp) => rsvp.status === 'GOING');
  const decided = rsvps.filter((rsvp) => ['GOING', 'TENTATIVE', 'DECLINED'].includes(rsvp.status));
  const attendance = ended.map((event) => event.going || 0);
  const usage = withCapacity.map((event) => Math.min(1, (event.going || 0) / event.maxAttendees));
  const types = {};
  for (const event of visible) {
    const key = event.kind || 'General';
    types[key] = (types[key] || 0) + (event.going || 0);
  }
  const average = (values) => values.length
    ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
    : 0;
  return {
    totalEvents: visible.length,
    upcomingEvents: visible.filter((event) => event.effective === 'UPCOMING').length,
    totalAttendees: going.length,
    averageAttendance: average(attendance),
    averageCapacityUsage: withCapacity.length
      ? Math.round((usage.reduce((sum, value) => sum + value, 0) / usage.length) * 1000) / 10
      : 0,
    rsvpConversion: decided.length ? Math.round((going.length / decided.length) * 1000) / 10 : 0,
    cancellationRate: visible.length ? Math.round((cancelled.length / visible.length) * 1000) / 10 : 0,
    waitlistUsage: waitlistCount,
    popularTypes: Object.entries(types)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([kind, attendees]) => ({ kind, attendees })),
    attendanceOverTime: ended.slice(-12).map((event) => ({
      name: event.name,
      startAt: event.startAt,
      going: event.going || 0,
    })),
  };
}

function paginate(items, page = 1, pageSize = 12) {
  const current = Math.max(1, Number(page) || 1);
  const size = Math.min(50, Math.max(1, Number(pageSize) || 12));
  const start = (current - 1) * size;
  return {
    page: current,
    pageSize: size,
    total: items.length,
    items: items.slice(start, start + size),
  };
}

module.exports = {
  HORIZON_MS,
  SERIES_WINDOW,
  TIMEZONES,
  asArray,
  buildStats,
  cleanImageSource,
  cleanUrl,
  dateKey,
  decideRsvp,
  AUTOMATIC_REMINDERS,
  defaultNotify,
  duplicateInput,
  effectiveStatus,
  formatEventWhen,
  inputError,
  isEligible,
  isValidTimeZone,
  matchesBucket,
  nextOccurrence,
  nextPosition,
  normalizeEventInput,
  normalizeReminders,
  paginate,
  parseWallClock,
  planSeriesInstances,
  reminderRunAt,
  renderHash,
  resequence,
  snowflake,
  statusLabel,
  utcParts,
  wallFields,
};
