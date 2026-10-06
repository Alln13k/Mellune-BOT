const { NextResponse } = require('next/server');
const { prisma } = require('../../../database/client');
const { getSession } = require('../../../lib/session');
const { verifyMelluneOwnerRole } = require('../../../lib/discordOAuth');

async function GET(request) {
  const session = await getSession(request);
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }
  try {
    if (!(await verifyMelluneOwnerRole(session.user.id))) {
      return NextResponse.json(
        { error: 'You need the Mellune owner role.' },
        { status: 403 },
      );
    }
    const guild = await prisma.guild.findUnique({
      where: { id: process.env.MELLUNE_GUILD_ID },
      select: { id: true, name: true },
    });
    return NextResponse.json({ guilds: guild ? [guild] : [] });
  } catch {
    return NextResponse.json(
      { error: 'Mellune role authorization could not be verified.' },
      { status: 502 },
    );
  }
}

module.exports = { GET };
