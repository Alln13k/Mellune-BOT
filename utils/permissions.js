const { PermissionFlagsBits } = require('discord.js');
const { errorEmbed } = require('./embeds');

function canModerate(actor, target, botMember) {
  if (!target || !botMember) return { ok: false, reason: 'I could not find that member.' };
  if (target.id === actor.id) return { ok: false, reason: 'You cannot moderate yourself.' };
  if (target.id === actor.guild.ownerId) return { ok: false, reason: 'The server owner cannot be moderated.' };
  if (target.roles.highest.position >= botMember.roles.highest.position) {
    return { ok: false, reason: 'That member has a role equal to or higher than mine.' };
  }
  if (actor.id !== actor.guild.ownerId && target.roles.highest.position >= actor.roles.highest.position) {
    return { ok: false, reason: 'That member has a role equal to or higher than yours.' };
  }
  return { ok: true };
}

function requirePermission(interaction, permission) {
  if (!interaction.memberPermissions?.has(permission)) {
    return interaction.reply({ embeds: [errorEmbed('You do not have permission to use this command.')], ephemeral: true });
  }
  return null;
}

module.exports = { canModerate, requirePermission, PermissionFlagsBits };
