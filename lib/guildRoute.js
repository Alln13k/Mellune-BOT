const { NextResponse } = require('next/server');
const { requireGuildAccess } = require('./apiAuth');

/**
 * Wraps a guild-scoped route handler with authentication, guild isolation and
 * uniform error handling so individual routes only contain business logic.
 */
function guildRoute(handler) {
  return async function route(request, context) {
    const { guildId } = await context.params;
    const authorization = await requireGuildAccess(request, guildId);
    if (authorization.error) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status },
      );
    }
    try {
      return await handler({
        request,
        guildId,
        session: authorization.session,
      });
    } catch (error) {
      console.error('Dashboard route failed:', error.message);
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 },
      );
    }
  };
}

function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

module.exports = { guildRoute, badRequest };
