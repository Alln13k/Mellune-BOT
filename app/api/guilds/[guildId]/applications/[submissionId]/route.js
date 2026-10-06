const { prisma } = require('../../../../../../database/client');
const { botFetch } = require('../../../../../../lib/discordRest');
const {
  featureRoute,
  readBody,
  response,
} = require('../../../../../../lib/featureApi');
const { reviewSubmission } = require('../../../../../../services/applications/applicationService');

async function getSubmission(guildId, submissionId) {
  const id = Number(submissionId);
  if (!Number.isInteger(id)) throw new Error('Invalid application id.');
  const submission = await prisma.applicationSubmission.findFirst({
    where: {
      id,
      guildId,
      deletedAt: null,
      form: { guildId, deletedAt: null },
    },
    include: {
      form: {
        include: {
          questions: { orderBy: { position: 'asc' } },
        },
      },
      answers: { include: { question: true } },
      history: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!submission) throw new Error('Application not found.');
  return submission;
}

async function refreshIdentity(guildId, submission) {
  const member = await botFetch(`/guilds/${guildId}/members/${submission.userId}`).catch(
    () => null,
  );
  if (!member?.user) return submission;
  const identity = {
    username: member.user.username || submission.username,
    displayName:
      member.nick ||
      member.user.global_name ||
      member.user.username ||
      submission.displayName,
    avatar: member.user.avatar
      ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png?size=128`
      : submission.avatar,
  };
  await prisma.applicationSubmission.updateMany({
    where: { id: submission.id, guildId, deletedAt: null },
    data: identity,
  });
  return { ...submission, ...identity };
}

const GET = featureRoute(async ({ guildId, params }) => {
  const submission = await getSubmission(guildId, params.submissionId);
  return response({ submission: await refreshIdentity(guildId, submission) });
});

const PATCH = featureRoute(async ({ guildId, params, session, request }) => {
  const { submissionId } = params;
  const body = await readBody(request);
  const status = body.action === 'reopen' ? 'PENDING' : body.status;
  const guild = await botFetch(`/guilds/${guildId}`).catch(() => null);
  const result = await reviewSubmission(prisma, {
    guildId,
    submissionId: Number(submissionId),
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
});

const DELETE = featureRoute(async ({ guildId, params }) => {
  const result = await prisma.applicationSubmission.updateMany({
    where: {
      id: Number(params.submissionId),
      guildId,
      deletedAt: null,
      form: { guildId, deletedAt: null },
    },
    data: { deletedAt: new Date() },
  });
  return result.count
    ? response({ deleted: true })
    : response({ error: 'Application not found.' }, 404);
});

module.exports = { DELETE, GET, PATCH };
