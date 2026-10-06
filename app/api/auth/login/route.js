const crypto = require('node:crypto');
const { NextResponse } = require('next/server');
const { getDiscordAuthorizationUrl } = require('../../../../lib/discordOAuth');
const { setStateCookie } = require('../../../../lib/session');

function GET() {
  const state = crypto.randomBytes(24).toString('base64url');
  const headers = new Headers({ Location: getDiscordAuthorizationUrl(state) });
  setStateCookie(headers, state);
  return new NextResponse(null, { status: 307, headers });
}

module.exports = { GET };
