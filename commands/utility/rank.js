const { SlashCommandBuilder } = require('discord.js');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Show a member level.')
    .addUserOption((o) =>
      o.setName('member').setDescription('Member').setRequired(false),
    ),
  async execute(interaction, { prisma }) {
    const user = interaction.options.getUser('member') || interaction.user;
    const data = await prisma.levelUser.findUnique({
      where: {
        guildId_userId: { guildId: interaction.guild.id, userId: user.id },
      },
    });
    await interaction.reply({
      embeds: [
        successEmbed(
          `${user.username}'s rank`,
          `Level: **${data?.level || 0}**\nXP: **${data?.xp || 0}**\nMessages: **${data?.messages || 0}**`,
        ),
      ],
    });
  },
};
