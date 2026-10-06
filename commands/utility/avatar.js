const { SlashCommandBuilder } = require('discord.js');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Display a member avatar.')
    .addUserOption((option) =>
      option.setName('member').setDescription('Member').setRequired(false),
    ),
  async execute(interaction) {
    const user = interaction.options.getUser('member') || interaction.user;
    await interaction.reply({
      embeds: [
        successEmbed(
          `${user.username}'s avatar`,
          `[Open full size](${user.displayAvatarURL({ size: 1024 })})`,
        ).setImage(user.displayAvatarURL({ size: 1024 })),
      ],
    });
  },
};
