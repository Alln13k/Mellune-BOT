const DISCORD_API = 'https://discord.com/api/v10';
const MANAGE_GUILD = 0x20;

function requireOAuthConfig() {
  const required = [
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'DISCORD_REDIRECT_URI',
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Missing Discord OAuth configuration: ${missing.join(', ')}`,
    );
  }
}

function getDiscordAuthorizationUrl(state) {
  requireOAuthConfig();
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
    state,
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

async function exchangeCode(code) {
  requireOAuthConfig();
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
    }),
  });
  if (!response.ok) throw new Error('Discord OAuth token exchange failed.');
  return response.json();
}

async function discordFetch(path, accessToken) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok)
    throw new Error(`Discord API request failed (${response.status}).`);
  return response.json();
}

async function getUserContext(accessToken) {
  const [user, guilds] = await Promise.all([
    discordFetch('/users/@me', accessToken),
    discordFetch('/users/@me/guilds', accessToken),
  ]);
  return {
    user,
    guilds: guilds
      .filter(
        (guild) =>
          guild.owner ||
          (Number(guild.permissions) & MANAGE_GUILD) === MANAGE_GUILD,
      )
      .map(({ id, name, icon, owner }) => ({ id, name, icon, owner })),
  };
}

function canManageGuild(guilds, guildId) {
  return guilds.some((guild) => guild.id === guildId);
}

module.exports = {
  canManageGuild,
  exchangeCode,
  getDiscordAuthorizationUrl,
  getUserContext,
};
