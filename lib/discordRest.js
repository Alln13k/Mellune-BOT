const DISCORD_API = 'https://discord.com/api/v10';

async function botFetch(path, options = {}) {
  if (!process.env.DISCORD_TOKEN)
    throw new Error('Discord bot configuration is unavailable.');
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(`Discord request failed (${response.status}).`);
  return body;
}

async function guildResources(guildId) {
  const [channels, roles] = await Promise.all([
    botFetch(`/guilds/${guildId}/channels`),
    botFetch(`/guilds/${guildId}/roles`),
  ]);
  return {
    channels: channels
      .filter((channel) => [0, 2, 4, 5].includes(channel.type))
      .map(({ id, name, type, parent_id: parentId }) => ({
        id,
        name,
        type,
        parentId,
      })),
    roles: roles.map(({ id, name, position, managed, color }) => ({
      id,
      name,
      position,
      managed,
      color,
    })),
  };
}

module.exports = { botFetch, guildResources };
