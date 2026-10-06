const { SlashCommandBuilder } = require('discord.js');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check Mellune response time.'),
  async execute(interaction) {
    await interaction.reply({
      embeds: [
        successEmbed('Pong ♡', `Latency: **${interaction.client.ws.ping}ms**`),
      ],
    });
  },
};
