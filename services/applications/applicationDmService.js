const { botFetch } = require('../../lib/discordRest');
const { MELLUNE_DEFAULT_EMBED_COLOR } = require('../../lib/constants');

async function sendApplicationDecisionDm(submission, guildName) {
  const channel = await botFetch('/users/@me/channels', {
    method: 'POST',
    body: JSON.stringify({ recipient_id: submission.userId }),
  });
  const approved = submission.status === 'APPROVED';
  const embed = approved
    ? {
        color: Number.parseInt(MELLUNE_DEFAULT_EMBED_COLOR.slice(1), 16),
        title: 'Application Approved',
        description: `Your application for **${submission.form.title}** has been approved!\n\nThank you for applying to **${guildName}**.`,
        fields: [
          {
            name: 'Reviewed by',
            value: submission.reviewerUsername
              ? `@${submission.reviewerUsername}`
              : `<@${submission.reviewerId}>`,
          },
        ],
      }
    : {
        color: Number.parseInt(MELLUNE_DEFAULT_EMBED_COLOR.slice(1), 16),
        title: 'Application Update',
        description: `Unfortunately, your application for **${submission.form.title}** has been rejected.\n\nThank you for taking the time to apply.`,
        fields: [
          {
            name: 'Reason',
            value: submission.rejectionReason || 'No reason was provided.',
          },
          {
            name: 'Reviewed by',
            value: submission.reviewerUsername
              ? `@${submission.reviewerUsername}`
              : `<@${submission.reviewerId}>`,
          },
        ],
      };
  await botFetch(`/channels/${channel.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      embeds: [embed],
      allowed_mentions: { parse: [], users: [] },
    }),
  });
  return true;
}

module.exports = { sendApplicationDecisionDm };
