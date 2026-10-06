const test = require('node:test');
const assert = require('node:assert/strict');
const {
  checkRequirements,
  checkSubmissionLimit,
  createSubmission,
  normalizeAnswer,
  reviewSubmission,
  transitionSubmission,
} = require('../services/applications/applicationService');

function question(type, extra = {}) {
  return {
    id: extra.id || 1,
    label: extra.label || 'Question',
    prompt: 'Answer',
    required: true,
    type,
    choices: extra.choices || [],
    ...extra,
  };
}

test('application answers validate every configured question type', () => {
  assert.equal(normalizeAnswer(question('SHORT_TEXT'), '  Luna  '), 'Luna');
  assert.equal(normalizeAnswer(question('LONG_TEXT'), 'A longer answer'), 'A longer answer');
  assert.equal(normalizeAnswer(question('NUMBER'), '42'), '42');
  assert.equal(normalizeAnswer(question('YES_NO'), 'true'), 'Yes');
  assert.equal(
    normalizeAnswer(question('SINGLE_CHOICE', { choices: ['Blue', 'Pink'] }), 'pink'),
    'Pink',
  );
  assert.equal(
    normalizeAnswer(question('MULTIPLE_CHOICE', { choices: ['Blue', 'Pink'] }), 'pink, blue'),
    'Pink, Blue',
  );
  assert.throws(() => normalizeAnswer(question('NUMBER'), 'not a number'), /must be a number/);
  assert.throws(
    () => normalizeAnswer(question('SINGLE_CHOICE', { choices: ['Blue'] }), 'Pink'),
    /not a valid choice/,
  );
});

test('submission creation stores identity, normalized answers, and initial history', async () => {
  let created;
  const prisma = {
    levelUser: { findUnique: async () => ({ level: 4 }) },
    applicationSubmission: {
      count: async () => 0,
      findFirst: async () => null,
      create: async ({ data }) => {
        created = data;
        return { id: 12, ...data };
      },
    },
  };
  const form = {
    id: 8,
    guildId: 'guild-a',
    maxSubmissions: 1,
    cooldownSeconds: 0,
    minAccountAgeHours: 0,
    minMembershipHours: 0,
    requiredRoleId: null,
    minLevel: 0,
    questions: [
      question('SHORT_TEXT', { id: 1, label: 'Name' }),
      question('YES_NO', { id: 2, label: 'Ready' }),
    ],
  };
  const result = await createSubmission({
    ...prisma,
  }, {
    form,
    member: {
      id: 'user-1',
      displayName: 'Luna',
      joinedTimestamp: Date.now(),
      roles: { cache: new Map() },
    },
    user: {
      id: 'user-1',
      username: 'luna',
      globalName: 'Luna',
      createdTimestamp: Date.now(),
      displayAvatarURL: () => 'https://cdn.example/avatar.png',
    },
    answers: new Map([[1, '  Luna '], [2, 'yes']]),
  });

  assert.equal(result.id, 12);
  assert.equal(created.username, 'luna');
  assert.equal(created.displayName, 'Luna');
  assert.equal(created.avatar, 'https://cdn.example/avatar.png');
  assert.equal(created.answers.create[1].answer, 'Yes');
  assert.equal(created.history.create.newStatus, 'PENDING');
});

test('submission requirements and cooldown are enforced server-side', async () => {
  const form = {
    id: 4,
    guildId: 'guild-a',
    minAccountAgeHours: 24,
    minMembershipHours: 24,
    requiredRoleId: 'staff',
    minLevel: 3,
  };
  const prisma = {
    levelUser: { findUnique: async () => ({ level: 1 }) },
    applicationSubmission: {
      findFirst: async () => ({
        submittedAt: new Date(Date.now() - 30_000),
      }),
    },
  };
  await assert.rejects(
    checkRequirements(
      prisma,
      form,
      { id: 'user-1', joinedTimestamp: Date.now(), roles: { cache: new Map() } },
      { createdTimestamp: Date.now() },
    ),
    /at least 24 hours old.*server member.*required server role.*level 3/s,
  );
  await assert.rejects(
    checkSubmissionLimit(
      prisma,
      { ...form, minAccountAgeHours: 0, minMembershipHours: 0, requiredRoleId: null, minLevel: 0, cooldownSeconds: 3600, maxSubmissions: 0 },
      'user-1',
    ),
    /wait/,
  );
});

function transitionPrisma(initial, updateCount = 1) {
  const state = { ...initial };
  const events = [];
  const read = () => ({
    ...state,
    form: { id: state.formId, guildId: state.guildId, title: 'Staff Application' },
    answers: [],
    history: events,
  });
  const transaction = {
    applicationSubmission: {
      updateMany: async ({ where, data }) => {
        if (!updateCount || state.status !== where.status) return { count: 0 };
        Object.assign(state, data);
        return { count: 1 };
      },
      findFirst: async () => read(),
      findUnique: async () => read(),
      update: async ({ data }) => {
        Object.assign(state, data);
        return read();
      },
    },
    applicationReviewEvent: {
      create: async ({ data }) => {
        events.push({ id: events.length + 1, ...data });
      },
    },
  };
  return {
    state,
    events,
    applicationSubmission: {
      findFirst: async ({ where } = {}) =>
        where.guildId && where.guildId !== state.guildId ? null : read(),
      update: transaction.applicationSubmission.update,
    },
    $transaction: async (callback) => callback(transaction),
  };
}

test('review transitions are scoped, idempotent, and preserve reopen history', async () => {
  const prisma = transitionPrisma({
    id: 20,
    guildId: 'guild-a',
    formId: 8,
    status: 'PENDING',
    deletedAt: null,
  });
  const rejected = await transitionSubmission(prisma, {
    guildId: 'guild-a',
    submissionId: 20,
    status: 'REJECTED',
    reviewerId: 'reviewer-1',
    reviewerUsername: 'moderator',
    reason: 'Try again later',
  });
  assert.equal(rejected.changed, true);
  assert.equal(prisma.state.status, 'REJECTED');
  assert.equal(prisma.events[0].reviewerId, 'reviewer-1');

  const same = await transitionSubmission(prisma, {
    guildId: 'guild-a',
    submissionId: 20,
    status: 'REJECTED',
    reviewerId: 'reviewer-2',
    reviewerUsername: 'other-moderator',
  });
  assert.equal(same.changed, false);
  await assert.rejects(
    transitionSubmission(prisma, {
      guildId: 'guild-b',
      submissionId: 20,
      status: 'REJECTED',
      reviewerId: 'reviewer-2',
      reviewerUsername: 'other-moderator',
    }),
    /Application not found/,
  );

  const reopened = await transitionSubmission(prisma, {
    guildId: 'guild-a',
    submissionId: 20,
    status: 'PENDING',
    reviewerId: 'reviewer-2',
    reviewerUsername: 'other-moderator',
  });
  assert.equal(reopened.changed, true);
  assert.equal(prisma.events.length, 2);
  assert.equal(prisma.events[1].reviewerUsername, 'other-moderator');
});

test('DM delivery failure does not roll back an approval', async () => {
  const prisma = transitionPrisma({
    id: 21,
    guildId: 'guild-a',
    formId: 8,
    userId: 'applicant-1',
    status: 'PENDING',
    deletedAt: null,
  });
  const previousToken = process.env.DISCORD_TOKEN;
  process.env.DISCORD_TOKEN = '';
  try {
    const result = await reviewSubmission(prisma, {
      guildId: 'guild-a',
      submissionId: 21,
      status: 'APPROVED',
      reviewerId: 'reviewer-1',
      reviewerUsername: 'moderator',
      guildName: 'Mellune',
    });
    assert.equal(prisma.state.status, 'APPROVED');
    assert.equal(result.dmStatus, 'FAILED');
    assert.match(result.warning, /DM could not be delivered/);
  } finally {
    if (previousToken === undefined) delete process.env.DISCORD_TOKEN;
    else process.env.DISCORD_TOKEN = previousToken;
  }
});
