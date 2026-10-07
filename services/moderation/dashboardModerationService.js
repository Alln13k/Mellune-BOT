const { botFetch } = require('../../lib/discordRest');
const { createCase } = require('./caseService');

const PERMISSIONS = {
  KICK: 1n << 1n,
  BAN: 1n << 2n,
  MODERATE: 1n << 40n,
};

function hasPermission(value, permission) {
  try {
    return (BigInt(value || 0) & permission) === permission;
  } catch {
    return false;
  }
}

function highestRolePosition(member, roles) {
  return (member?.roles || []).reduce((highest, roleId) => {
    const role = roles.find((item) => item.id === roleId);
    return Math.max(highest, role?.position || 0);
  }, 0);
}

async function moderationContext(guildId, userId) {
  const botUser = await botFetch('/users/@me');
  const [guild, target, botMember, roles] = await Promise.all([
    botFetch(`/guilds/${guildId}`),
    botFetch(`/guilds/${guildId}/members/${userId}`),
    botFetch(`/guilds/${guildId}/members/${botUser.id}`),
    botFetch(`/guilds/${guildId}/roles`),
  ]);
  if (guild.owner_id === userId) {
    throw new Error('The server owner cannot be moderated.');
  }
  if (botUser.id === userId) {
    throw new Error('Mellune cannot moderate itself.');
  }
  const botRolePosition = highestRolePosition(botMember, roles);
  const targetRolePosition = highestRolePosition(target, roles);
  if (targetRolePosition >= botRolePosition) {
    throw new Error('This member is above Mellune in the role hierarchy.');
  }
  return { guild, target, botMember, roles };
}

function auditHeaders(reason) {
  return reason
    ? { 'X-Audit-Log-Reason': encodeURIComponent(reason.slice(0, 512)) }
    : undefined;
}

async function sendDirectMessage(userId, content) {
  const channel = await botFetch('/users/@me/channels', {
    method: 'POST',
    body: JSON.stringify({ recipient_id: userId }),
  });
  await botFetch(`/channels/${channel.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: content.slice(0, 2000) }),
  });
}

async function executeDashboardModeration({
  prisma,
  guildId,
  userId,
  moderatorId,
  action,
  reason,
  durationMinutes,
  message,
}) {
  const normalizedAction = String(action || '').toUpperCase();
  const cleanReason = String(reason || '').trim().slice(0, 500) || 'No reason provided.';
  if (normalizedAction === 'DM') {
    await botFetch(`/guilds/${guildId}/members/${userId}`);
    const content = String(message || '').trim();
    if (!content) throw new Error('Write a message before sending the DM.');
    await sendDirectMessage(userId, content);
    return { action: normalizedAction, userId };
  }
  const context = await moderationContext(guildId, userId);
  const permission =
    normalizedAction === 'BAN'
      ? PERMISSIONS.BAN
      : normalizedAction === 'KICK'
        ? PERMISSIONS.KICK
        : ['TIMEOUT', 'UNTIMEOUT'].includes(normalizedAction)
          ? PERMISSIONS.MODERATE
          : null;
  if (permission && !hasPermission(context.botMember.permissions, permission)) {
    throw new Error('Mellune does not have the Discord permission required for this action.');
  }

  if (normalizedAction === 'TIMEOUT') {
    const minutes = Math.min(40320, Math.max(1, Number(durationMinutes) || 60));
    await botFetch(`/guilds/${guildId}/members/${userId}`, {
      method: 'PATCH',
      headers: auditHeaders(cleanReason),
      body: JSON.stringify({
        communication_disabled_until: new Date(
          Date.now() + minutes * 60 * 1000,
        ).toISOString(),
      }),
    });
  } else if (normalizedAction === 'UNTIMEOUT') {
    await botFetch(`/guilds/${guildId}/members/${userId}`, {
      method: 'PATCH',
      headers: auditHeaders(cleanReason),
      body: JSON.stringify({ communication_disabled_until: null }),
    });
  } else if (normalizedAction === 'KICK') {
    await botFetch(`/guilds/${guildId}/members/${userId}`, {
      method: 'DELETE',
      headers: auditHeaders(cleanReason),
    });
  } else if (normalizedAction === 'BAN') {
    await botFetch(`/guilds/${guildId}/bans/${userId}`, {
      method: 'PUT',
      headers: auditHeaders(cleanReason),
      body: JSON.stringify({ delete_message_seconds: 0 }),
    });
  } else if (normalizedAction !== 'WARN') {
    throw new Error('Unsupported moderation action.');
  }

  if (normalizedAction !== 'DM') {
    await createCase(prisma, {
      guild: { id: guildId, name: context.guild.name },
      target: {
        id: userId,
        user: {
          username: context.target.user?.username || userId,
        },
      },
      moderator: { id: moderatorId },
      action: normalizedAction,
      reason: cleanReason,
    });
  }
  return { action: normalizedAction, userId };
}

module.exports = {
  executeDashboardModeration,
  hasPermission,
  highestRolePosition,
  moderationContext,
};
