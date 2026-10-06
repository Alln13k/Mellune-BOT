const { EmbedBuilder } = require('discord.js');

const PLACEHOLDER_VALUES = [
  'user',
  'username',
  'displayname',
  'userid',
  'server',
  'serverid',
  'membercount',
  'avatar',
];

function renderText(value, context = {}) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{(\w+)\}/g, (match, key) => {
    if (!PLACEHOLDER_VALUES.includes(key.toLowerCase())) return match;
    const resolved = context[key] ?? context[key.toLowerCase()];
    return resolved === undefined || resolved === null
      ? match
      : String(resolved);
  });
}

function renderPayload(payload = {}, context = {}) {
  const rendered = JSON.parse(JSON.stringify(payload || {}));
  const walk = (value) => {
    if (typeof value === 'string') return renderText(value, context);
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, walk(item)]),
      );
    }
    return value;
  };
  return walk(rendered);
}

function buildEmbed(payload = {}, context = {}) {
  const rendered = renderPayload(payload, context);
  const embed = new EmbedBuilder();
  if (rendered.title) embed.setTitle(rendered.title);
  if (rendered.description) embed.setDescription(rendered.description);
  if (rendered.url) embed.setURL(rendered.url);
  if (rendered.color) embed.setColor(rendered.color);
  if (rendered.timestamp)
    embed.setTimestamp(
      rendered.timestamp === true ? new Date() : new Date(rendered.timestamp),
    );
  if (rendered.author?.name) {
    embed.setAuthor({
      name: rendered.author.name,
      iconURL: rendered.author.iconUrl || undefined,
      url: rendered.author.url || undefined,
    });
  }
  if (rendered.footer?.text) {
    embed.setFooter({
      text: rendered.footer.text,
      iconURL: rendered.footer.iconUrl || undefined,
    });
  }
  if (rendered.thumbnail?.url) embed.setThumbnail(rendered.thumbnail.url);
  if (rendered.image?.url) embed.setImage(rendered.image.url);
  if (Array.isArray(rendered.fields)) {
    embed.addFields(
      rendered.fields
        .filter((field) => field?.name && field?.value)
        .slice(0, 25)
        .map((field) => ({
          name: String(field.name).slice(0, 256),
          value: String(field.value).slice(0, 1024),
          inline: Boolean(field.inline),
        })),
    );
  }
  return embed;
}

function memberContext(member) {
  const user = member.user || member;
  const avatar = user.displayAvatarURL
    ? user.displayAvatarURL({ extension: 'png', size: 256 })
    : null;
  return {
    user: `<@${user.id}>`,
    username: user.username,
    displayname: member.displayName || user.globalName || user.username,
    userid: user.id,
    server: member.guild?.name,
    serverid: member.guild?.id,
    membercount: member.guild?.memberCount,
    avatar,
  };
}

module.exports = {
  PLACEHOLDER_VALUES,
  buildEmbed,
  memberContext,
  renderPayload,
  renderText,
};
