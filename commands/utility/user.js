const { SlashCommandBuilder } = require('discord.js');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('Show a member profile.')
    .addUserOption((option) =>
      option
        .setName('member')
        .setDescription('Member to inspect')
        .setRequired(false),
    ),
  async execute(interaction) {
    const user = interaction.options.getUser('member') || interaction.user;
    await interaction.reply({
      embeds: [
        successEmbed(
          user.username,
          `User ID: \`${user.id}\`\nJoined Discord: <t:${Math.floor(user.createdTimestamp / 1000)}:D>`,
        ),
      ],
    });
  },
};
