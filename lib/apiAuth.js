const { canManageGuild, getUserContext } = require('./discordOAuth');
const { getSession } = require('./session');

async function requireGuildAccess(request, guildId) {
  const session = await getSession(request);
  if (!session?.accessToken) {
    return { error: 'Authentication required.', status: 401 };
  }
  try {
    const context = await getUserContext(session.accessToken);
    if (!canManageGuild(context.guilds, guildId)) {
      return { error: 'You cannot manage this server.', status: 403 };
    }
    return { session, context };
  } catch {
    return {
      error: 'Discord authorization could not be verified.',
      status: 502,
    };
  }
}

module.exports = { requireGuildAccess };
