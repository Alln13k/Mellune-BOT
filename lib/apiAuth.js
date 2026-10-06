const { verifyMelluneOwnerRole } = require('./discordOAuth');
const { getSession } = require('./session');

async function requireGuildAccess(request, guildId) {
  const session = await getSession(request);
  if (!session?.accessToken) {
    return { error: 'Authentication required.', status: 401 };
  }
  if (guildId !== process.env.MELLUNE_GUILD_ID) {
    return { error: 'You cannot manage this server.', status: 403 };
  }
  try {
    if (!(await verifyMelluneOwnerRole(session.user.id))) {
      return { error: 'You need the Mellune owner role.', status: 403 };
    }
    return { session };
  } catch {
    return {
      error: 'Mellune role authorization could not be verified.',
      status: 502,
    };
  }
}

module.exports = { requireGuildAccess };
