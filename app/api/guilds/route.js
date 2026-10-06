const { NextResponse } = require('next/server');
const { prisma } = require('../../../database/client');
const { requireOwner } = require('../../../lib/apiAuth');

async function GET(request) {
  const authorization = await requireOwner(request);
  if (authorization.error) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }
  try {
    const guild = await prisma.guild.findUnique({
      where: { id: process.env.MELLUNE_GUILD_ID },
      select: { id: true, name: true },
    });
    return NextResponse.json({ guilds: guild ? [guild] : [] });
  } catch (error) {
    console.error('Guild lookup failed:', error.message);
    return NextResponse.json(
      { error: 'Could not load your servers.' },
      { status: 500 },
    );
  }
}

module.exports = { GET };
