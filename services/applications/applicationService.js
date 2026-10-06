const { sendApplicationDecisionDm } = require('./applicationDmService');

const QUESTION_TYPES = [
  'SHORT_TEXT',
  'LONG_TEXT',
  'NUMBER',
  'YES_NO',
  'MULTIPLE_CHOICE',
  'SINGLE_CHOICE',
];

const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

function cleanChoices(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((choice) => (typeof choice === 'string' ? choice : choice?.label))
    .filter((choice) => typeof choice === 'string' && choice.trim())
    .map((choice) => choice.trim().slice(0, 100))
    .filter((choice, index, choices) => choices.indexOf(choice) === index)
    .slice(0, 25);
}

function normalizeQuestion(question, position) {
  const type = QUESTION_TYPES.includes(question?.type)
    ? question.type
    : 'LONG_TEXT';
  const choices = ['MULTIPLE_CHOICE', 'SINGLE_CHOICE'].includes(type)
    ? cleanChoices(question.choices)
    : [];
  return {
    label: String(question?.label || `Question ${position + 1}`)
      .trim()
      .slice(0, 45),
    prompt: String(question?.prompt || 'Your answer').trim().slice(0, 200),
    description:
      typeof question?.description === 'string'
        ? question.description.trim().slice(0, 200)
        : null,
    type,
    choices,
    required: question?.required !== false,
    position,
  };
}

function questionPlaceholder(question) {
  if (question.description) return question.description;
  if (question.type === 'YES_NO') return 'Yes or no';
  if (question.type === 'NUMBER') return 'Enter a number';
  if (question.choices?.length) {
    return question.choices.slice(0, 3).join(', ');
  }
  return question.prompt;
}

function normalizeAnswer(question, value) {
  const answer = String(value ?? '').trim();
  if (!answer) {
    if (question.required) {
      throw new Error(`"${question.label}" is required.`);
    }
    return '';
  }
  if (answer.length > 4000) {
    throw new Error(`"${question.label}" is too long.`);
  }
  if (question.type === 'NUMBER') {
    if (!Number.isFinite(Number(answer))) {
      throw new Error(`"${question.label}" must be a number.`);
    }
    return answer;
  }
  if (question.type === 'YES_NO') {
    const normalized = answer.toLowerCase();
    if (!['yes', 'no', 'true', 'false'].includes(normalized)) {
      throw new Error(`"${question.label}" must be answered yes or no.`);
    }
    return ['yes', 'true'].includes(normalized) ? 'Yes' : 'No';
  }
  if (['MULTIPLE_CHOICE', 'SINGLE_CHOICE'].includes(question.type)) {
    const selected = answer
      .split(',')
      .map((choice) => choice.trim())
      .filter(Boolean);
    if (question.type === 'SINGLE_CHOICE' && selected.length !== 1) {
      throw new Error(`Choose one option for "${question.label}".`);
    }
    if (question.type === 'MULTIPLE_CHOICE' && selected.length < 1) {
      throw new Error(`Choose at least one option for "${question.label}".`);
    }
    const choices = question.choices || [];
    const canonical = selected.map((selectedChoice) => {
      const match = choices.find(
        (choice) => choice.toLowerCase() === selectedChoice.toLowerCase(),
      );
      if (!match) {
        throw new Error(`"${selectedChoice}" is not a valid choice for "${question.label}".`);
      }
      return match;
    });
    return [...new Set(canonical)].join(', ');
  }
  return answer;
}

function validateAnswers(questions, answers) {
  const values = answers instanceof Map ? answers : new Map(Object.entries(answers || {}));
  return questions.map((question) => ({
    questionId: question.id,
    questionLabel: question.label,
    questionType: question.type,
    answer: normalizeAnswer(question, values.get(String(question.id)) ?? values.get(question.id)),
  }));
}

async function checkRequirements(prisma, form, member, user, now = Date.now()) {
  const failures = [];
  const createdTimestamp = user?.createdTimestamp ?? user?.createdAt;
  if (
    form.minAccountAgeHours > 0 &&
    createdTimestamp &&
    now - new Date(createdTimestamp).getTime() < form.minAccountAgeHours * 3600000
  ) {
    failures.push(`Your Discord account must be at least ${form.minAccountAgeHours} hours old.`);
  }
  if (
    form.minMembershipHours > 0 &&
    member?.joinedTimestamp &&
    now - member.joinedTimestamp < form.minMembershipHours * 3600000
  ) {
    failures.push(`You must be a server member for at least ${form.minMembershipHours} hours.`);
  }
  if (form.requiredRoleId && !member?.roles?.cache?.has(form.requiredRoleId)) {
    failures.push('You do not have the required server role.');
  }
  if (form.minLevel > 0) {
    const level = await prisma.levelUser.findUnique({
      where: {
        guildId_userId: {
          guildId: form.guildId,
          userId: member.id,
        },
      },
      select: { level: true },
    });
    if ((level?.level || 0) < form.minLevel) {
      failures.push(`You must be at least Mellune level ${form.minLevel}.`);
    }
  }
  if (failures.length) throw new Error(failures.join(' '));
}

async function checkSubmissionLimit(prisma, form, userId, now = new Date()) {
  const where = {
    guildId: form.guildId,
    formId: form.id,
    userId,
    deletedAt: null,
  };
  if (form.maxSubmissions > 0) {
    const total = await prisma.applicationSubmission.count({ where });
    if (total >= form.maxSubmissions) {
      throw new Error('You have reached the submission limit for this application.');
    }
  }
  if (form.cooldownSeconds > 0) {
    const latest = await prisma.applicationSubmission.findFirst({
      where,
      orderBy: { submittedAt: 'desc' },
      select: { submittedAt: true },
    });
    if (
      latest &&
      now.getTime() - new Date(latest.submittedAt).getTime() <
        form.cooldownSeconds * 1000
    ) {
      const remaining = Math.ceil(
        (form.cooldownSeconds * 1000 -
          (now.getTime() - new Date(latest.submittedAt).getTime())) /
          60000,
      );
      throw new Error(`Please wait ${Math.max(1, remaining)} minute(s) before applying again.`);
    }
  }
}

async function createSubmission(prisma, {
  form,
  member,
  user,
  answers,
  now = new Date(),
}) {
  const create = async (transaction) => {
    await checkRequirements(transaction, form, member, user, now.getTime());
    await checkSubmissionLimit(transaction, form, user.id, now);
    const normalizedAnswers = validateAnswers(form.questions || [], answers);
    const identity = {
      userId: user.id,
      username: user.username || 'Unknown user',
      displayName: member?.displayName || user.globalName || user.username || 'Unknown user',
      avatar: user.displayAvatarURL?.({ extension: 'png', size: 128 }) || null,
    };
    return transaction.applicationSubmission.create({
      data: {
        guildId: form.guildId,
        formId: form.id,
        ...identity,
        status: 'PENDING',
        submittedAt: now,
        answers: { create: normalizedAnswers },
        history: {
          create: {
            guildId: form.guildId,
            previousStatus: null,
            newStatus: 'PENDING',
          },
        },
      },
      include: { answers: true, history: true },
    });
  };
  if (!prisma.$transaction) return create(prisma);
  return prisma.$transaction(create, {
    isolationLevel: 'Serializable',
  });
}

async function transitionSubmission(prisma, {
  guildId,
  submissionId,
  status,
  reviewerId,
  reviewerUsername,
  reason = null,
  now = new Date(),
}) {
  if (!REVIEW_STATUSES.includes(status)) throw new Error('Invalid application status.');
  const submission = await prisma.applicationSubmission.findFirst({
    where: {
      id: submissionId,
      guildId,
      deletedAt: null,
      form: { guildId, deletedAt: null },
    },
    include: { form: true },
  });
  if (!submission) throw new Error('Application not found.');
  if (submission.status === status) {
    return { submission, changed: false };
  }
  const validTransition =
    (submission.status === 'PENDING' &&
      ['APPROVED', 'REJECTED'].includes(status)) ||
    (submission.status === 'REJECTED' && status === 'PENDING');
  if (!validTransition) {
    throw new Error(`Cannot change ${submission.status} applications to ${status}.`);
  }
  const reopening = status === 'PENDING';
  const data = {
    status,
    reviewerId: reopening ? null : reviewerId,
    reviewerUsername: reopening ? null : reviewerUsername,
    rejectionReason: status === 'REJECTED' ? reason || null : null,
    reviewedAt: reopening ? null : now,
    dmStatus: reopening ? 'NOT_SENT' : 'PENDING',
    dmError: null,
  };
  const write = async (transaction) => {
    const changed = await transaction.applicationSubmission.updateMany({
      where: {
        id: submission.id,
        guildId,
        status: submission.status,
        deletedAt: null,
      },
      data,
    });
    if (!changed.count) {
      const current = await transaction.applicationSubmission.findFirst({
        where: { id: submission.id, guildId, deletedAt: null },
        include: { form: true, answers: true, history: { orderBy: { createdAt: 'asc' } } },
      });
      if (current?.status === status) return { submission: current, changed: false };
      throw new Error('This application was already reviewed. Refresh and try again.');
    }
    await transaction.applicationReviewEvent.create({
      data: {
        guildId,
        submissionId: submission.id,
        previousStatus: submission.status,
        newStatus: status,
        reviewerId,
        reviewerUsername,
        reason: status === 'REJECTED' ? reason || null : null,
      },
    });
    const updated = await transaction.applicationSubmission.findUnique({
      where: { id: submission.id },
      include: { form: true, answers: true, history: { orderBy: { createdAt: 'asc' } } },
    });
    return { submission: updated, changed: true };
  };
  const updated = prisma.$transaction
    ? await prisma.$transaction(write)
    : await write(prisma);
  return updated;
}

async function reviewSubmission(prisma, {
  guildId,
  submissionId,
  status,
  reviewerId,
  reviewerUsername,
  reason,
  guildName,
  now = new Date(),
}) {
  const result = await transitionSubmission(prisma, {
    guildId,
    submissionId,
    status,
    reviewerId,
    reviewerUsername,
    reason,
    now,
  });
  if (!result.changed || status === 'PENDING') {
    return { ...result, dmStatus: result.submission.dmStatus };
  }
  try {
    await sendApplicationDecisionDm(result.submission, guildName);
    const submission = await prisma.applicationSubmission.update({
      where: { id: result.submission.id },
      data: { dmStatus: 'DELIVERED', dmError: null },
      include: {
        form: true,
        answers: true,
        history: { orderBy: { createdAt: 'asc' } },
      },
    });
    return { submission, changed: true, dmStatus: 'DELIVERED' };
  } catch (error) {
    const submission = await prisma.applicationSubmission.update({
      where: { id: result.submission.id },
      data: { dmStatus: 'FAILED', dmError: error.message.slice(0, 500) },
      include: {
        form: true,
        answers: true,
        history: { orderBy: { createdAt: 'asc' } },
      },
    });
    return {
      submission,
      changed: true,
      dmStatus: 'FAILED',
      warning: "Application updated, but the applicant's DM could not be delivered.",
    };
  }
}

module.exports = {
  QUESTION_TYPES,
  REVIEW_STATUSES,
  checkRequirements,
  checkSubmissionLimit,
  cleanChoices,
  createSubmission,
  normalizeAnswer,
  normalizeQuestion,
  questionPlaceholder,
  reviewSubmission,
  transitionSubmission,
  validateAnswers,
};
