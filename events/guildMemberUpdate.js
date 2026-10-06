const { Events } = require('discord.js');
const { sendLog, EVENT_KEYS } = require('../services/logging/logService');

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember, client) {
    const before = oldMember.roles.cache;
    const after = newMember.roles.cache;
    const added = after.filter((role) => !before.has(role.id));
    const removed = before.filter((role) => !after.has(role.id));
    if (!added.size && !removed.size) return;
    await sendLog(
      client,
      newMember.guild,
      EVENT_KEYS.ROLE_CHANGE,
      'Member roles changed',
      `${newMember.user} roles were updated.`,
      [
        {
          name: 'Added',
          value: added.map((role) => role.name).join(', ') || 'None',
          inline: true,
        },
        {
          name: 'Removed',
          value: removed.map((role) => role.name).join(', ') || 'None',
          inline: true,
        },
      ],
    ).catch(() => {});
  },
};
