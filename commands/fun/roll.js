const { SlashCommandBuilder } = require('discord.js');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll a die.')
    .addIntegerOption((o) =>
      o
        .setName('sides')
        .setDescription('Number of sides')
        .setMinValue(2)
        .setMaxValue(1000)
        .setRequired(false),
    ),
  async execute(interaction) {
    const sides = interaction.options.getInteger('sides') || 6;
    await interaction.reply({
      embeds: [
        successEmbed(
          'Dice roll',
          `You rolled **${Math.floor(Math.random() * sides) + 1}** (d${sides}).`,
        ),
      ],
    });
  },
};
