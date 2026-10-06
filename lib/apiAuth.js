const { verifyMelluneOwnerRole } = require('./discordOAuth');
const { getSession } = require('./session');

const OWNER_CACHE_TTL_MS = 60 * 1000;
const ownerCache = new Map();

async function isMelluneOwner(userId) {
  const cached = ownerCache.get(userId);
  if (cached && cached > Date.now()) return true;
  ownerCache.delete(userId);
  const allowed = await verifyMelluneOwnerRole(userId);
  if (allowed) ownerCache.set(userId, Date.now() + OWNER_CACHE_TTL_MS);
  return allowed;
}

async function requireOwner(request) {
  const session = await getSession(request);
  if (!session?.accessToken) {
    return { error: 'Authentication required.', status: 401 };
  }
  try {
    if (!(await isMelluneOwner(session.user.id))) {
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

async function requireGuildAccess(request, guildId) {
  if (guildId !== process.env.MELLUNE_GUILD_ID) {
    const session = await getSession(request);
    if (!session?.accessToken) {
      return { error: 'Authentication required.', status: 401 };
    }
    return { error: 'You cannot manage this server.', status: 403 };
  }
  return requireOwner(request);
}

module.exports = { requireOwner, requireGuildAccess, isMelluneOwner };
