const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('Browse Mellune commands.'),
  async execute(interaction) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('help-category')
      .setPlaceholder('Choose a category')
      .addOptions(
        { label: 'Moderation', value: 'moderation', emoji: '🛡️' },
        { label: 'Configuration', value: 'configuration', emoji: '⚙️' },
        { label: 'Tickets', value: 'tickets', emoji: '🎫' },
        { label: 'Utility', value: 'utility', emoji: '🛠️' },
        { label: 'Fun', value: 'fun', emoji: '🎉' },
        { label: 'Leveling', value: 'leveling', emoji: '📈' },
      );
    await interaction.reply({
      embeds: [successEmbed('Mellune help', 'Choose a category below to discover the available commands.')],
      components: [new ActionRowBuilder().addComponents(menu)],
    });
  },
};
