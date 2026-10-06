const { SlashCommandBuilder } = require('discord.js');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the server XP leaderboard.'),
  async execute(interaction, { prisma }) {
    const users = await prisma.levelUser.findMany({
      where: { guildId: interaction.guild.id },
      orderBy: { xp: 'desc' },
      take: 10,
    });
    const lines = users.length
      ? users
          .map(
            (entry, index) =>
              `**${index + 1}.** <@${entry.userId}> — level ${entry.level} (${entry.xp} XP)`,
          )
          .join('\n')
      : 'No XP has been earned yet.';
    await interaction.reply({
      embeds: [successEmbed('Level leaderboard', lines)],
    });
  },
};
