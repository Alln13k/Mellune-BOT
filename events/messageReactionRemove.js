const { Events } = require('discord.js');
const { handleReaction } = require('../services/roles/reactionRoleService');

module.exports = {
  name: Events.MessageReactionRemove,
  async execute(reaction, user, client) {
    await handleReaction(reaction, user, client.prisma, false).catch((error) =>
      console.error('Reaction role removal failed:', error.message),
    );
  },
};
