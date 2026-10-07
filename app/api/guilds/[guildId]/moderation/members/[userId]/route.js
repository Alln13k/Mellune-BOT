const { NextResponse } = require('next/server');
const { prisma } = require('../../../../../../../database/client');
const { guildRoute } = require('../../../../../../../lib/guildRoute');
const { botFetch } = require('../../../../../../../lib/discordRest');
const { readBody } = require('../../../../../../../lib/featureApi');
const { executeDashboardModeration } = require('../../../../../../../services/moderation/dashboardModerationService');

function avatarUrl(guildId, member, user) {
  if (member.avatar) {
    return `https://cdn.discordapp.com/guilds/${guildId}/users/${user.id}/avatars/${member.avatar}.png?size=256`;
  }
  if (user.avatar) {
    const extension = user.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=256`;
  }
  return null;
}

function bannerUrl(user) {
  if (!user.banner) return null;
  const extension = user.banner.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.${extension}?size=1024`;
}

function snowflakeDate(id) {
  try {
    return new Date(Number((BigInt(id) >> 22n) + 1420070400000n)).toISOString();
  } catch {
    return null;
  }
}

async function getMemberProfile(guildId, userId) {
  const [member, user, roles, cases] = await Promise.all([
    botFetch(`/guilds/${guildId}/members/${userId}`),
    botFetch(`/users/${userId}`),
    botFetch(`/guilds/${guildId}/roles`),
    prisma.moderationCase.findMany({
      where: { guildId, targetId: userId },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
  ]);
  const roleMap = new Map(roles.map((role) => [role.id, role]));
  return {
    user: {
      id: user.id,
      username: user.username,
      globalName: user.global_name || null,
      displayName: member.nick || user.global_name || user.username,
      avatar: avatarUrl(guildId, member, user),
      banner: bannerUrl(user),
      accentColor: user.accent_color
        ? `#${user.accent_color.toString(16).padStart(6, '0')}`
        : null,
      createdAt: snowflakeDate(user.id),
      bot: user.bot === true,
    },
    member: {
      joinedAt: member.joined_at || null,
      roles: (member.roles || [])
        .map((roleId) => roleMap.get(roleId))
        .filter(Boolean)
        .map(({ id, name, color, position }) => ({ id, name, color, position })),
      timeoutUntil: member.communication_disabled_until || null,
      pending: member.pending === true,
    },
    cases,
  };
}

const GET = guildRoute(async ({ guildId, params }) => {
  const profile = await getMemberProfile(guildId, params.userId);
  return NextResponse.json({ profile });
});

const POST = guildRoute(async ({ guildId, params, session, request }) => {
  const body = await readBody(request);
  let result;
  try {
    result = await executeDashboardModeration({
      prisma,
      guildId,
      userId: params.userId,
      moderatorId: session.user.id,
      action: body.action,
      reason: body.reason,
      durationMinutes: body.durationMinutes,
      message: body.message,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'The moderation action could not be completed.' },
      { status: error.status === 403 ? 403 : 400 },
    );
  }
  return NextResponse.json(result);
});

module.exports = { GET, POST };
