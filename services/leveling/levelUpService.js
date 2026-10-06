const { EmbedBuilder } = require('discord.js');
const { MELLUNE_DEFAULT_COLOR_INT } = require('../../utils/embeds');

async function notifyLevelUp(message, result, settings) {
  if (!settings?.levelUpEnabled || !settings.levelUpChannelId || !result.leveledUp) {
    return false;
  }
  const channel = await message.guild.channels.fetch(settings.levelUpChannelId).catch(() => null);
  if (!channel?.isTextBased()) return false;
  const user = message.member?.displayName || message.author.username;
  const payload = settings.levelUpPayload || {};
  const replace = (value) =>
    String(value || '')
      .replaceAll('{user}', `<@${message.author.id}>`)
      .replaceAll('{username}', message.author.username)
      .replaceAll('{displayname}', user)
      .replaceAll('{userid}', message.author.id)
      .replaceAll('{level}', String(result.entry.level))
      .replaceAll('{xp}', String(result.entry.xp))
      .replaceAll('{server}', message.guild.name)
      .replaceAll('{membercount}', String(message.guild.memberCount));
  const embed = new EmbedBuilder()
    .setColor(MELLUNE_DEFAULT_COLOR_INT)
    .setTitle(replace(payload.title || 'Level up!'))
    .setDescription(
      replace(payload.description || '🎉 {user} reached level {level}!'),
    );
  if (payload.footer) embed.setFooter({ text: replace(payload.footer) });
  if (payload.timestamp) embed.setTimestamp();
  await channel.send({
    content: settings.levelUpMention ? `<@${message.author.id}>` : undefined,
    embeds: [embed],
    allowedMentions: settings.levelUpMention
      ? { users: [message.author.id] }
      : { parse: [] },
  });
  return true;
}

module.exports = { notifyLevelUp };
