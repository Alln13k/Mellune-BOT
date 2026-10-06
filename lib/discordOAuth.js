const DISCORD_API = 'https://discord.com/api/v10';
const MANAGE_GUILD = 0x20;
const MELLUNE_PANEL_ACCESS_ROLE_ID = '1557080607094210560';

function requireOAuthConfig(required) {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Missing Discord OAuth configuration: ${missing.join(', ')}`,
    );
  }
}

function getDiscordAuthorizationUrl(state) {
  requireOAuthConfig(['DISCORD_CLIENT_ID', 'DISCORD_REDIRECT_URI']);
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds guilds.join guilds.members.read',
    state,
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

async function exchangeCode(code) {
  requireOAuthConfig([
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'DISCORD_REDIRECT_URI',
  ]);
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

async function joinMelluneGuild(accessToken, userId) {
  const guildId = process.env.MELLUNE_GUILD_ID;
  const botToken = process.env.DISCORD_TOKEN;
  if (!guildId || !botToken) {
    throw new Error(
      'MELLUNE_GUILD_ID and DISCORD_TOKEN are required for guild join.',
    );
  }
  const response = await fetch(
    `${DISCORD_API}/guilds/${guildId}/members/${userId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_token: accessToken }),
    },
  );
  if (!response.ok && response.status !== 204) {
    throw new Error(`Mellune guild join failed (${response.status}).`);
  }
}

async function verifyMelluneOwnerRole(userId) {
  const guildId = process.env.MELLUNE_GUILD_ID;
  const roleId = process.env.MELLUNE_OWNER_ROLE_ID;
  const botToken = process.env.DISCORD_TOKEN;
  if (!guildId || !botToken) {
    throw new Error(
      'MELLUNE_GUILD_ID and DISCORD_TOKEN are required.',
    );
  }
  const response = await fetch(
    `${DISCORD_API}/guilds/${guildId}/members/${userId}`,
    {
      headers: { Authorization: `Bot ${botToken}` },
    },
  );
  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(`Mellune role verification failed (${response.status}).`);
  }
  const member = await response.json();
  return (
    Array.isArray(member.roles) &&
    (member.roles.includes(MELLUNE_PANEL_ACCESS_ROLE_ID) ||
      (roleId && member.roles.includes(roleId)))
  );
}

function canManageGuild(guilds, guildId) {
  return guilds.some((guild) => guild.id === guildId);
}

module.exports = {
  canManageGuild,
  exchangeCode,
  getDiscordAuthorizationUrl,
  getUserContext,
  joinMelluneGuild,
  MELLUNE_PANEL_ACCESS_ROLE_ID,
  verifyMelluneOwnerRole,
};
