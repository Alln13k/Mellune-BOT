const test = require('node:test');
const assert = require('node:assert/strict');
const {
  executeDashboardModeration,
  hasPermission,
  highestRolePosition,
} = require('../services/moderation/dashboardModerationService');

test('dashboard moderation checks Discord permissions and role hierarchy helpers', () => {
  assert.equal(hasPermission('4', 4n), true);
  assert.equal(hasPermission('4', 2n), false);
  assert.equal(
    highestRolePosition(
      { roles: ['low', 'high'] },
      [
        { id: 'low', position: 2 },
        { id: 'high', position: 8 },
      ],
    ),
    8,
  );
});

test('dashboard timeout uses the bot REST API and records a moderation case', async () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.DISCORD_TOKEN;
  const requests = [];
  process.env.DISCORD_TOKEN = 'test-token';
  global.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith('/guilds/guild')) {
      return globalThis.Response.json({ id: 'guild', name: 'Mellune', owner_id: 'owner' });
    }
    if (url.endsWith('/members/target')) {
      return globalThis.Response.json({ user: { id: 'target', username: 'luna' }, roles: [] });
    }
    if (url.endsWith('/users/@me')) {
      return globalThis.Response.json({ id: 'bot' });
    }
    if (url.endsWith('/members/bot')) {
      return globalThis.Response.json({
        user: { id: 'bot' },
        roles: ['bot-role'],
        permissions: String(1n << 40n),
      });
    }
    if (url.endsWith('/roles')) {
      return globalThis.Response.json([
        { id: 'guild', position: 0 },
        { id: 'bot-role', position: 5 },
      ]);
    }
    if (url.endsWith('/members/target')) return globalThis.Response.json({});
    return globalThis.Response.json({}, { status: 200 });
  };
  const cases = [];
  const prisma = {
    guild: { upsert: async () => ({}) },
    user: { upsert: async () => ({}) },
    moderationCase: { create: async ({ data }) => { cases.push(data); return { id: 1, ...data }; } },
    activityEvent: { create: async () => ({}) },
  };
  try {
    await executeDashboardModeration({
      prisma,
      guildId: 'guild',
      userId: 'target',
      moderatorId: 'moderator',
      action: 'TIMEOUT',
      durationMinutes: 10,
      reason: 'Too many pings',
    });
    const patch = requests.find((request) => request.options.method === 'PATCH');
    assert.ok(patch);
    assert.match(JSON.parse(patch.options.body).communication_disabled_until, /T/);
    assert.equal(cases[0].action, 'TIMEOUT');
    assert.equal(cases[0].reason, 'Too many pings');
  } finally {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.DISCORD_TOKEN;
    else process.env.DISCORD_TOKEN = originalToken;
  }
});
