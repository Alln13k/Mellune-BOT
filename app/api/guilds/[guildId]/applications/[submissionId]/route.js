const { prisma } = require('../../../../../../database/client');
const {
  featureRoute,
  readBody,
  response,
} = require('../../../../../../lib/featureApi');

async function getSubmission(guildId, submissionId) {
  const id = Number(submissionId);
  if (!Number.isInteger(id)) throw new Error('Invalid application id.');
  const submission = await prisma.applicationSubmission.findFirst({
    where: { id, guildId },
  });
  if (!submission) throw new Error('Application not found.');
  return submission;
}

const PATCH = featureRoute(async ({ guildId, params, session, request }) => {
  const { submissionId } = params;
  const submission = await getSubmission(guildId, submissionId);
  const body = await readBody(request);
  const status = ['PENDING', 'APPROVED', 'REJECTED'].includes(body.status)
    ? body.status
    : null;
  if (!status) throw new Error('Invalid application status.');
  const updated = await prisma.applicationSubmission.update({
    where: { id: submission.id },
    data: {
      status,
      reviewerId: session.user.id,
      notes: typeof body.notes === 'string' ? body.notes.slice(0, 2000) : null,
    },
    include: { answers: true },
  });
  return response({ submission: updated });
});

module.exports = { PATCH };
