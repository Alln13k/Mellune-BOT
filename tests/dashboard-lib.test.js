const test = require('node:test');
const assert = require('node:assert/strict');
const { bucketize, getRangeStart, parseRange } = require('../lib/analytics');
const { renderTemplate } = require('../lib/welcomeTemplate');
const validate = require('../lib/validate');

const NOW = new Date('2026-10-06T12:30:00.000Z');

test('bucketize returns a continuous series and counts events per day', () => {
  const series = bucketize(
    [
      new Date('2026-10-06T01:00:00Z'),
      new Date('2026-10-06T11:59:00Z'),
      new Date('2026-10-04T08:00:00Z'),
      new Date('2026-09-01T00:00:00Z'),
      new Date('2026-10-07T00:00:00Z'),
      'not-a-date',
    ],
    '7d',
    NOW,
  );
  assert.equal(series.length, 7);
  assert.equal(series.at(-1).count, 2);
  assert.equal(series.at(-3).count, 1);
  assert.equal(
    series.reduce((sum, point) => sum + point.count, 0),
    3,
  );
});

test('bucketize supports hourly ranges and falls back to 7d', () => {
  assert.equal(bucketize([], '24h', NOW).length, 24);
  assert.equal(bucketize([], '30d', NOW).length, 30);
  assert.equal(parseRange('bogus'), '7d');
  assert.equal(
    getRangeStart('24h', NOW).toISOString(),
    '2026-10-05T13:00:00.000Z',
  );
});

test('renderTemplate substitutes known placeholders only', () => {
  const values = { user: '<@1>', username: 'Luna', server: '{user}' };
  assert.equal(
    renderTemplate('Hi {user} / {username} / {unknown}', values),
    'Hi <@1> / Luna / {unknown}',
  );
  assert.equal(renderTemplate('{server}', values), '{user}');
  assert.equal(renderTemplate(null, values), '');
});

test('validators sanitise untrusted input', () => {
  assert.equal(validate.snowflake('123456789012345678'), '123456789012345678');
  assert.equal(validate.snowflake('abc'), null);
  assert.equal(validate.snowflake(42), null);
  assert.equal(validate.color('#AABBCC'), '#AABBCC');
  assert.equal(validate.color('red'), '#b9a7ff');
  assert.equal(validate.nullableText('   ', 10), null);
  assert.equal(validate.text('abcdef', 3), 'abc');
  assert.equal(validate.bool('true'), false);
});

test('welcome service greets members with restricted mentions and assigns the auto-role', async () => {
  const { handleMemberJoin } = require('../services/welcome/welcomeService');
  const sent = [];
  const roles = [];
  const prisma = {
    guild: { upsert: async () => ({}) },
    user: { upsert: async () => ({}) },
    welcomeConfig: {
      findUnique: async () => ({
        enabled: true,
        channelId: '100000000000000001',
        welcomeText: 'Hi {user} to {server} #{memberCount}',
        autoRoleId: '200000000000000002',
        dmEnabled: false,
      }),
    },
  };
  const member = {
    id: '300000000000000003',
    user: { id: '300000000000000003', username: 'Luna', bot: false },
    guild: {
      id: '1',
      name: 'Mellune',
      memberCount: 42,
      channels: {
        fetch: async () => ({
          isTextBased: () => true,
          send: async (payload) => sent.push(payload),
        }),
      },
    },
    roles: { add: async (id) => roles.push(id) },
  };
  await handleMemberJoin(prisma, member);
  assert.deepEqual(roles, ['200000000000000002']);
  assert.equal(sent[0].content, 'Hi <@300000000000000003> to Mellune #42');
  assert.deepEqual(sent[0].allowedMentions.roles, []);
});
