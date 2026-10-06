const { SlashCommandBuilder } = require('discord.js');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin.'),
  async execute(interaction) {
    await interaction.reply({ embeds: [successEmbed('Coin flip', Math.random() < 0.5 ? '🪙 Heads' : '🪙 Tails')] });
  },
};
