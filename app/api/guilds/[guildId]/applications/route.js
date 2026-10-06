const { prisma } = require('../../../../../database/client');
const { botFetch } = require('../../../../../lib/discordRest');
const {
  featureRoute,
  getResources,
  queueJob,
  readBody,
  response,
  snowflake,
  text,
} = require('../../../../../lib/featureApi');
const {
  normalizeQuestion,
  reviewSubmission,
} = require('../../../../../services/applications/applicationService');

const PAGE_SIZE = 20;

function dateValue(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(endOfDay ? `${value}T23:59:59.999Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calendarStart(now, month) {
  const date = new Date(now);
  if (month) return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function makeStats(forms, countRows, latestRows, weekRows, monthRows, reviewRows) {
  const counts = new Map();
  for (const row of countRows) {
    const current = counts.get(row.formId) || { total: 0, pending: 0, approved: 0, rejected: 0 };
    current.total += row._count._all;
    if (row.status === 'PENDING') current.pending += row._count._all;
    if (row.status === 'APPROVED') current.approved += row._count._all;
    if (row.status === 'REJECTED') current.rejected += row._count._all;
    counts.set(row.formId, current);
  }
  const latest = new Map(latestRows.map((row) => [row.formId, row._max.submittedAt]));
  const week = new Map(weekRows.map((row) => [row.formId, row._count._all]));
  const month = new Map(monthRows.map((row) => [row.formId, row._count._all]));
  const durations = new Map();
  for (const row of reviewRows) {
    const seconds = Number(row.averageSeconds);
    if (!Number.isFinite(seconds) || seconds < 0) continue;
    durations.set(row.formId, { total: seconds, count: 1 });
  }
  return forms.map((form) => {
    const current = counts.get(form.id) || { total: 0, pending: 0, approved: 0, rejected: 0 };
    const duration = durations.get(form.id);
    return {
      id: form.id,
      name: form.title,
      description: form.description,
      enabled: form.enabled,
      createdAt: form.createdAt,
      lastSubmission: latest.get(form.id) || null,
      total: current.total,
      pending: current.pending,
      approved: current.approved,
      rejected: current.rejected,
      approvalRate: current.total ? Math.round((current.approved / current.total) * 100) : 0,
      rejectionRate: current.total ? Math.round((current.rejected / current.total) * 100) : 0,
      averageReviewHours: duration?.count
        ? Math.round((duration.total / duration.count / 3600) * 10) / 10
        : 0,
      thisWeek: week.get(form.id) || 0,
      thisMonth: month.get(form.id) || 0,
    };
  });
}

const GET = featureRoute(async ({ request, guildId }) => {
  const url = new URL(request.url);
  const requestedFormId = Number(url.searchParams.get('formId'));
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(PAGE_SIZE, Math.max(1, Number(url.searchParams.get('pageSize')) || PAGE_SIZE));
  const status = ['PENDING', 'APPROVED', 'REJECTED'].includes(url.searchParams.get('status'))
    ? url.searchParams.get('status')
    : null;
  const search = (url.searchParams.get('search') || '').trim().slice(0, 100);
  const from = dateValue(url.searchParams.get('from'));
  const to = dateValue(url.searchParams.get('to'), true);
  const sort = url.searchParams.get('sort') === 'oldest' ? 'asc' : 'desc';
  const formsWhere = { guildId, deletedAt: null };
  const weekStart = calendarStart(new Date());
  const monthStart = calendarStart(new Date(), true);
  const [forms, counts, latest, weekRows, monthRows, reviewRows, resources] =
    await Promise.all([
      prisma.applicationForm.findMany({
        where: formsWhere,
        orderBy: { createdAt: 'asc' },
        include: {
          questions: {
            where: { deletedAt: null },
            orderBy: { position: 'asc' },
          },
        },
      }),
      prisma.applicationSubmission.groupBy({
        by: ['formId', 'status'],
        where: { guildId, deletedAt: null },
        _count: { _all: true },
      }),
      prisma.applicationSubmission.groupBy({
        by: ['formId'],
        where: { guildId, deletedAt: null },
        _max: { submittedAt: true },
      }),
      prisma.applicationSubmission.groupBy({
        by: ['formId'],
        where: { guildId, deletedAt: null, submittedAt: { gte: weekStart } },
        _count: { _all: true },
      }),
      prisma.applicationSubmission.groupBy({
        by: ['formId'],
        where: { guildId, deletedAt: null, submittedAt: { gte: monthStart } },
        _count: { _all: true },
      }),
      prisma.$queryRaw`
        SELECT "formId",
          AVG(EXTRACT(EPOCH FROM ("reviewedAt" - "submittedAt"))) AS "averageSeconds"
        FROM "ApplicationSubmission"
        WHERE "guildId" = ${guildId}
          AND "deletedAt" IS NULL
          AND "reviewedAt" IS NOT NULL
        GROUP BY "formId"
      `,
      getResources(guildId),
    ]);
  const stats = makeStats(forms, counts, latest, weekRows, monthRows, reviewRows);
  const overview = stats.reduce(
    (total, item) => ({
      pending: total.pending + item.pending,
      approved: total.approved + item.approved,
      rejected: total.rejected + item.rejected,
      total: total.total + item.total,
    }),
    { pending: 0, approved: 0, rejected: 0, total: 0 },
  );
  const selectedForm = forms.find((form) => form.id === requestedFormId) || forms[0] || null;
  const submissionWhere = {
    guildId,
    deletedAt: null,
    ...(selectedForm ? { formId: selectedForm.id } : {}),
    ...(status ? { status } : {}),
    ...(from || to ? { submittedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(search
      ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
            { userId: { contains: search } },
          ],
        }
      : {}),
  };
  const [submissions, submissionTotal] = selectedForm
    ? await Promise.all([
        prisma.applicationSubmission.findMany({
          where: submissionWhere,
          orderBy: { submittedAt: sort },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            formId: true,
            userId: true,
            username: true,
            displayName: true,
            avatar: true,
            status: true,
            submittedAt: true,
            reviewedAt: true,
            reviewerId: true,
            reviewerUsername: true,
            rejectionReason: true,
            dmStatus: true,
            dmError: true,
          },
        }),
        prisma.applicationSubmission.count({ where: submissionWhere }),
      ])
    : [[], 0];
  return response({
    types: stats,
    overview,
    selectedTypeId: selectedForm?.id || null,
    selectedType: selectedForm,
    submissions,
    pagination: {
      page,
      pageSize,
      total: submissionTotal,
      pages: Math.max(1, Math.ceil(submissionTotal / pageSize)),
    },
    channels: resources.channels.filter((channel) => [0, 5].includes(channel.type)),
    roles: resources.roles,
  });
});

async function saveQuestions(transaction, formId, rawQuestions) {
  const questions = (Array.isArray(rawQuestions) ? rawQuestions : [])
    .slice(0, 5)
    .map((question, index) => ({
      id: Number.isInteger(Number(question.id)) ? Number(question.id) : null,
      ...normalizeQuestion(question, index),
    }));
  if (!questions.length) {
    throw new Error('Add at least one question to the application type.');
  }
  const existing = await transaction.applicationQuestion.findMany({
    where: { formId, deletedAt: null },
    select: { id: true },
  });
  const kept = [];
  for (const question of questions) {
    const data = {
      formId,
      label: question.label,
      prompt: question.prompt,
      description: question.description,
      type: question.type,
      choices: question.choices,
      required: question.required,
      position: question.position,
      deletedAt: null,
    };
    if (question.id && existing.some((item) => item.id === question.id)) {
      await transaction.applicationQuestion.update({ where: { id: question.id }, data });
      kept.push(question.id);
    } else {
      const created = await transaction.applicationQuestion.create({ data });
      kept.push(created.id);
    }
  }
  const removed = existing.filter((question) => !kept.includes(question.id)).map((question) => question.id);
  if (removed.length) {
    await transaction.applicationQuestion.updateMany({
      where: { id: { in: removed }, formId },
      data: { deletedAt: new Date() },
    });
  }
}

const POST = featureRoute(async ({ request, guildId, session }) => {
  const body = await readBody(request);
  if (body.action === 'review' || body.action === 'reopen') {
    const status = body.action === 'reopen' ? 'PENDING' : body.status;
    const guild = await botFetch(`/guilds/${guildId}`).catch(() => null);
    const result = await reviewSubmission(prisma, {
      guildId,
      submissionId: Number(body.id),
      status,
      reviewerId: session.user.id,
      reviewerUsername: session.user.username || session.user.globalName || session.user.id,
      reason: typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) : null,
      guildName: guild?.name || 'your server',
    });
    return response({
      submission: result.submission,
      warning: result.warning || null,
      dmStatus: result.dmStatus,
    });
  }
  const data = {
    title: text(body.title, 100, 'New application'),
    description: text(body.description, 1000, 'Answer the questions below.'),
    destinationChannelId: snowflake(body.destinationChannelId),
    notificationChannelId: snowflake(body.notificationChannelId),
    reviewRoleId: snowflake(body.reviewRoleId),
    maxSubmissions: Math.min(20, Math.max(1, Number(body.maxSubmissions) || 1)),
    cooldownSeconds: Math.min(31_536_000, Math.max(0, Number(body.cooldownSeconds) || 0)),
    minAccountAgeHours: Math.min(8760, Math.max(0, Number(body.minAccountAgeHours) || 0)),
    requiredRoleId: snowflake(body.requiredRoleId),
    minLevel: Math.min(1000, Math.max(0, Number(body.minLevel) || 0)),
    minMembershipHours: Math.min(8760, Math.max(0, Number(body.minMembershipHours) || 0)),
    enabled: body.enabled === true,
  };
  const existing = body.id
    ? await prisma.applicationForm.findFirst({
        where: { id: Number(body.id), guildId, deletedAt: null },
      })
    : null;
  const form = await prisma.$transaction(async (transaction) => {
    const saved = existing
      ? await transaction.applicationForm.update({
          where: { id: existing.id },
          data,
        })
      : await transaction.applicationForm.create({
          data: { guildId, ...data },
        });
    await saveQuestions(transaction, saved.id, body.questions);
    return transaction.applicationForm.findUnique({
      where: { id: saved.id },
      include: { questions: { where: { deletedAt: null }, orderBy: { position: 'asc' } } },
    });
  });
  let jobId = null;
  if (body.publish) {
    if (!form.enabled) throw new Error('Enable the application type before publishing it.');
    if (!form.destinationChannelId) throw new Error('Choose a destination channel before publishing it.');
    const job = await queueJob(prisma, guildId, 'SEND_APPLICATION_PANEL', {
      formId: form.id,
      channelId: form.destinationChannelId,
    });
    jobId = job.id;
  }
  return response({ form, jobId });
});

const DELETE = featureRoute(async ({ request, guildId }) => {
  const body = await readBody(request);
  const id = Number(body.id);
  if (!Number.isInteger(id)) return response({ error: 'Invalid application type.' }, 400);
  const deleted = await prisma.applicationForm.updateMany({
    where: { id, guildId, deletedAt: null },
    data: { deletedAt: new Date(), enabled: false },
  });
  return deleted.count
    ? response({ deleted: true })
    : response({ error: 'Application type not found.' }, 404);
});

module.exports = { DELETE, GET, POST };
