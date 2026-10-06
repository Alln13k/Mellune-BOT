const { SlashCommandBuilder } = require('discord.js');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('List member warnings.')
    .addUserOption((o) =>
      o.setName('member').setDescription('Member').setRequired(true),
    ),
  async execute(interaction, { prisma }) {
    const member = interaction.options.getUser('member');
    const warnings = await prisma.warning.findMany({
      where: { guildId: interaction.guild.id, userId: member.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    await interaction.reply({
      embeds: [
        successEmbed(
          `${member.username}'s warnings`,
          warnings.length
            ? warnings
                .map((warning) => `**#${warning.id}** — ${warning.reason}`)
                .join('\n')
            : 'No warnings found.',
        ),
      ],
      ephemeral: true,
    });
  },
};
