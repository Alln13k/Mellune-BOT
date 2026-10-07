const { NextResponse } = require('next/server');
const {
  exchangeCode,
  getUserContext,
  joinMelluneGuild,
  verifyMelluneOwnerRole,
} = require('../../../../lib/discordOAuth');
const { getOAuthState, setSessionCookie } = require('../../../../lib/session');

async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state || state !== getOAuthState(request)) {
    return NextResponse.json(
      { error: 'Invalid OAuth state.' },
      { status: 400 },
    );
  }

  try {
    const token = await exchangeCode(code);
    const context = await getUserContext(token.access_token);
    await joinMelluneGuild(token.access_token, context.user.id);
    if (!(await verifyMelluneOwnerRole(context.user.id))) {
      return NextResponse.json(
        { error: 'You need the Mellune owner role to access this dashboard.' },
        { status: 403 },
      );
    }
    const headers = new Headers({ Location: '/dashboard' });
    await setSessionCookie(headers, {
      accessToken: token.access_token,
      user: context.user,
    });
    return new NextResponse(null, { status: 307, headers });
  } catch (error) {
    console.error('Discord OAuth callback failed:', error.message);
    return NextResponse.json(
      { error: 'Discord login failed. Check the server configuration.' },
      { status: 502 },
    );
  }
}

module.exports = { GET };
