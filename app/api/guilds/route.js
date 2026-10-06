const { NextResponse } = require('next/server');
const { getSession } = require('../../../lib/session');
const { getUserContext } = require('../../../lib/discordOAuth');

async function GET(request) {
  const session = await getSession(request);
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }
  try {
    const context = await getUserContext(session.accessToken);
    return NextResponse.json({ guilds: context.guilds });
  } catch {
    return NextResponse.json(
      { error: 'Discord authorization could not be verified.' },
      { status: 502 },
    );
  }
}

module.exports = { GET };
