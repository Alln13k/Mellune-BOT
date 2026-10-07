const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildStats,
  decideRsvp,
  duplicateInput,
  effectiveStatus,
  isEligible,
  nextOccurrence,
  parseWallClock,
  planSeriesInstances,
  reminderRunAt,
} = require('../services/events/eventLogic');
const { commitRsvp, deliverReminder } = require('../services/events/eventService');
const { buildEventEmbed } = require('../services/events/eventMessage');

const baseEvent = {
  id: 1,
  guildId: 'guild',
  name: 'Community Game Night',
  description: 'Join us',
  startAt: new Date('2026-10-10T18:00:00.000Z'),
  endAt: new Date('2026-10-10T20:00:00.000Z'),
  timezone: 'Europe/Paris',
  status: 'UPCOMING',
  publishedAt: new Date('2026-10-01T00:00:00.000Z'),
  rsvpEnabled: true,
  maxAttendees: 1,
  roleIds: [],
  roleMode: 'ANY',
  notifyConfig: {},
};

function memoryPrisma(seed = {}) {
  const db = {
    events: [{ ...baseEvent, ...(seed.event || {}) }],
    rsvps: seed.rsvps || [],
    waitlist: seed.waitlist || [],
    logs: [],
    reminders: seed.reminders || [],
  };
  let chain = Promise.resolve();
  let nextId = 10;
  const tx = {
    communityEvent: {
      findFirst: async ({ where }) => db.events.find((event) => event.id === where.id && event.guildId === where.guildId) || null,
      update: async ({ where, data }) => {
        const event = db.events.find((item) => item.id === where.id);
        Object.assign(event, data);
        return event;
      },
    },
    communityEventRsvp: {
      count: async ({ where }) => db.rsvps.filter((rsvp) => rsvp.eventId === where.eventId && (!where.status || rsvp.status === where.status)).length,
      findUnique: async ({ where }) => db.rsvps.find((rsvp) => rsvp.eventId === where.eventId_userId.eventId && rsvp.userId === where.eventId_userId.userId) || null,
      findMany: async ({ where }) => db.rsvps.filter((rsvp) => rsvp.eventId === where.eventId && where.status.in.includes(rsvp.status)),
      upsert: async ({ where, create, update }) => {
        const key = where.eventId_userId;
        const existing = db.rsvps.find((rsvp) => rsvp.eventId === key.eventId && rsvp.userId === key.userId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created = { id: nextId++, createdAt: new Date(), ...create };
        db.rsvps.push(created);
        return created;
      },
      delete: async ({ where }) => {
        const index = db.rsvps.findIndex((rsvp) => rsvp.id === where.id);
        db.rsvps.splice(index, 1);
      },
    },
    communityEventWaitlistEntry: {
      findUnique: async ({ where }) => db.waitlist.find((entry) => entry.eventId === where.eventId_userId.eventId && entry.userId === where.eventId_userId.userId) || null,
      findFirst: async ({ where }) => db.waitlist.filter((entry) => entry.eventId === where.eventId).sort((a, b) => a.position - b.position)[0] || null,
      findMany: async ({ where }) => db.waitlist.filter((entry) => entry.eventId === where.eventId),
      create: async ({ data }) => {
        const created = { id: nextId++, createdAt: new Date(), ...data };
        db.waitlist.push(created);
        return created;
      },
      delete: async ({ where }) => {
        const index = db.waitlist.findIndex((entry) => entry.id === where.id);
        db.waitlist.splice(index, 1);
      },
      update: async ({ where, data }) => {
        const entry = db.waitlist.find((item) => item.id === where.id);
        Object.assign(entry, data);
        return entry;
      },
    },
    communityEventLog: { create: async ({ data }) => { db.logs.push(data); return data; } },
    communityEventReminder: {
      update: async ({ where, data }) => {
        const reminder = db.reminders.find((item) => item.id === where.id);
        Object.assign(reminder, data);
        return reminder;
      },
    },
  };
  return {
    db,
    $transaction(fn) {
      const run = chain.then(() => fn(tx));
      chain = run.then(() => {}, () => {});
      return run;
    },
  };
}

test('event times stay anchored to the selected timezone', () => {
  const start = parseWallClock('2026-10-10', '20:00', 'Europe/Paris');
  assert.equal(start.toISOString(), '2026-10-10T18:00:00.000Z');
  const next = nextOccurrence(start, { recurrence: 'WEEKLY', interval: 1, timezone: 'Europe/Paris', weekdays: [] });
  assert.equal(next.toISOString(), '2026-10-17T18:00:00.000Z');
});

test('event status comes from publication and timestamps', () => {
  const now = new Date('2026-10-10T18:30:00.000Z');
  assert.equal(effectiveStatus({ ...baseEvent, publishedAt: null, publishAt: null }, now), 'DRAFT');
  assert.equal(effectiveStatus({ ...baseEvent, publishedAt: null, publishAt: new Date('2026-10-12T00:00:00.000Z') }, now), 'SCHEDULED');
  assert.equal(effectiveStatus(baseEvent, new Date('2026-10-09T00:00:00.000Z')), 'UPCOMING');
  assert.equal(effectiveStatus(baseEvent, now), 'LIVE');
  assert.equal(effectiveStatus(baseEvent, new Date('2026-10-10T21:00:00.000Z')), 'ENDED');
  assert.equal(effectiveStatus({ ...baseEvent, cancelledAt: now }, now), 'CANCELLED');
});

test('role requirements support any and all modes', () => {
  const event = { roleIds: ['123456789012345678', '223456789012345678'], roleMode: 'ANY' };
  assert.equal(isEligible(event, ['223456789012345678']), true);
  assert.equal(isEligible({ ...event, roleMode: 'ALL' }, ['223456789012345678']), false);
  assert.equal(isEligible({ ...event, roleMode: 'ALL' }, ['123456789012345678', '223456789012345678']), true);
});

test('a full event waitlists instead of creating another going RSVP', () => {
  const decision = decideRsvp({ event: baseEvent, goingCount: 1, requested: 'GOING' });
  assert.equal(decision.action, 'waitlist');
  const change = decideRsvp({ event: baseEvent, existingStatus: 'GOING', goingCount: 1, requested: 'TENTATIVE' });
  assert.equal(change.action, 'set');
  assert.equal(change.status, 'TENTATIVE');
  assert.equal(change.promote, true);
});

test('duplicate copies configuration without attendance', () => {
  const copy = duplicateInput({ ...baseEvent, messageId: 'message', rsvps: [{ userId: 'user' }] });
  assert.equal(copy.publishNow, false);
  assert.equal(copy.name.startsWith('Copy of'), true);
  assert.equal(copy.rsvps, undefined);
});

test('statistics use only supplied attendance records', () => {
  const stats = buildStats(
    [{ ...baseEvent, status: 'ENDED', endedAt: baseEvent.endAt, going: 1, maxAttendees: 2, kind: 'Game' }],
    [{ status: 'GOING' }, { status: 'DECLINED' }],
    1,
  );
  assert.equal(stats.totalAttendees, 1);
  assert.equal(stats.popularTypes[0].kind, 'Game');
  assert.equal(stats.waitlistUsage, 1);
  assert.equal(buildStats([], [], 0).totalEvents, 0);
});

test('series planning stays inside a finite window', () => {
  const planned = planSeriesInstances({
    enabled: true,
    recurrence: 'DAILY',
    interval: 1,
    timezone: 'UTC',
    anchorStart: new Date('2026-10-07T18:00:00.000Z'),
    weekdays: [],
  }, [], new Date('2026-10-07T00:00:00.000Z'));
  assert.ok(planned.length <= 4);
  assert.ok(planned.at(-1) < new Date('2026-12-07T00:00:00.000Z'));
});

test('simultaneous RSVPs cannot pass the attendee limit', async () => {
  const prisma = memoryPrisma();
  const user = (id) => ({ userId: id, username: id, displayName: id, avatar: null, roleIds: [] });
  await Promise.all([
    commitRsvp(prisma, { guildId: 'guild', eventId: 1, user: user('a'), requested: 'GOING' }),
    commitRsvp(prisma, { guildId: 'guild', eventId: 1, user: user('b'), requested: 'GOING' }),
  ]);
  assert.equal(prisma.db.rsvps.filter((rsvp) => rsvp.status === 'GOING').length, 1);
  assert.equal(prisma.db.waitlist.length, 1);
  assert.equal(prisma.db.waitlist[0].position, 1);
});

test('leaving a full event promotes the first waitlisted member', async () => {
  const prisma = memoryPrisma({
    rsvps: [{ id: 2, eventId: 1, guildId: 'guild', userId: 'going', username: 'going', status: 'GOING' }],
    waitlist: [{ id: 3, eventId: 1, guildId: 'guild', userId: 'wait', username: 'wait', position: 1, createdAt: new Date() }],
  });
  const result = await commitRsvp(prisma, {
    guildId: 'guild',
    eventId: 1,
    user: { userId: 'going', username: 'going', roleIds: [] },
    requested: 'DECLINED',
  });
  assert.equal(result.promoted.userId, 'wait');
  assert.equal(prisma.db.waitlist.length, 0);
  assert.equal(prisma.db.rsvps.find((rsvp) => rsvp.userId === 'wait').status, 'GOING');
  assert.equal(prisma.db.rsvps.find((rsvp) => rsvp.userId === 'going').status, 'DECLINED');
});

test('a failed reminder DM does not stop the other deliveries', async () => {
  const sent = [];
  const reminder = {
    id: 7,
    offsetMinutes: 60,
    includeTentative: false,
    targets: ['DM'],
    event: baseEvent,
  };
  const prisma = {
    communityEventRsvp: {
      findMany: async () => [
        { userId: 'ok', status: 'GOING' },
        { userId: 'fail', status: 'GOING' },
      ],
    },
    communityEventReminder: { update: async ({ data }) => { reminder.saved = data; return data; } },
    communityEventLog: { create: async () => ({}) },
  };
  const client = {
    users: {
      fetch: async (userId) => {
        if (userId === 'fail') throw new Error('closed');
        return { send: async () => sent.push(userId) };
      },
    },
  };
  await deliverReminder(prisma, client, reminder);
  assert.deepEqual(sent, ['ok']);
  assert.equal(reminder.saved.status, 'SENT');
  assert.match(reminder.saved.error, /fail/);
});

test('slash event command can create and manage events without a long option list', () => {
  const command = require('../commands/community/event');
  const json = command.data.toJSON();
  const names = json.options.map((option) => option.name).sort();
  assert.deepEqual(names, ['cancel', 'create', 'edit', 'end', 'info', 'list', 'publish', 'remind']);
  const create = json.options.find((option) => option.name === 'create');
  assert.ok(create.options.length <= 8);
  assert.equal(typeof command.execute, 'function');
  assert.equal(typeof command.autocomplete, 'function');
});

test('event embed shows the schedule, capacity and Mellune color', () => {
  const embed = buildEventEmbed(baseEvent, { going: 17 });
  assert.equal(embed.title, 'Community Game Night');
  assert.equal(embed.color, 0x3c527f);
  assert.match(embed.fields.find((field) => field.name === 'Attendees').value, /17 \/ 1/);
  assert.match(embed.fields.find((field) => field.name === 'Date').value, /October 10/);
});

test('reminder instants are stored before the event start', () => {
  const runAt = reminderRunAt('2026-10-10T18:00:00.000Z', 60);
  assert.equal(runAt.toISOString(), '2026-10-10T17:00:00.000Z');
});
