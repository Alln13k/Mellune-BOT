const { NextResponse } = require('next/server');
const { getSession } = require('../../../../lib/session');

async function GET(request) {
  const session = await getSession(request);
  if (!session)
    return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, user: session.user });
}

module.exports = { GET };
