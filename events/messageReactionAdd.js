const { Events } = require('discord.js');
const { handleReaction } = require('../services/roles/reactionRoleService');

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user, client) {
    await handleReaction(reaction, user, client.prisma).catch((error) =>
      console.error('Reaction role add failed:', error.message),
    );
  },
};
