const { NextResponse } = require('next/server');
const {
  clearSessionCookie,
  destroySession,
} = require('../../../../lib/session');

async function POST(request) {
  await destroySession(request);
  const headers = new Headers();
  clearSessionCookie(headers);
  return NextResponse.json({ ok: true }, { headers });
}

module.exports = { POST };
