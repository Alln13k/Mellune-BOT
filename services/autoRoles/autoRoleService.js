const { PermissionFlagsBits } = require('discord.js');

async function applyAutoRoles(member, prisma) {
  const config = await prisma.autoRoleConfig.findUnique({
    where: { guildId: member.guild.id },
  });
  if (!config?.enabled || (config.ignoreBots && member.user.bot)) return [];
  const bot = member.guild.members.me;
  if (!bot?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    console.warn(`Mellune lacks Manage Roles in ${member.guild.id}.`);
    return [];
  }
  const roleIds = Array.isArray(config.roleIds) ? config.roleIds : [];
  const assigned = [];
  for (const roleId of roleIds) {
    const role = await member.guild.roles.fetch(roleId).catch(() => null);
    if (
      !role ||
      role.managed ||
      role.id === member.guild.id ||
      role.position >= bot.roles.highest.position
    ) {
      console.warn(`Auto role ${roleId} cannot be assigned in ${member.guild.id}.`);
      continue;
    }
    if (member.roles.cache.has(role.id)) continue;
    await member.roles.add(role, 'Mellune auto role on join')
      .then(() => assigned.push(role.id))
      .catch((error) =>
        console.error(`Auto role ${role.id} failed: ${error.message}`),
      );
  }
  return assigned;
}

module.exports = { applyAutoRoles };
