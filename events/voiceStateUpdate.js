const { Events } = require('discord.js');
const {
  handleVoiceStateUpdate,
} = require('../services/voice/tempVoiceService');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState, client) {
    if (newState.member?.user.bot) return;
    await handleVoiceStateUpdate(oldState, newState, client.prisma).catch(
      (error) => console.error('Temporary voice failed:', error.message),
    );
  },
};
