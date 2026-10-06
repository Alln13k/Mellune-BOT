const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { requirePermission } = require('../../utils/permissions');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription('Clear all warnings for a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) =>
      o.setName('member').setDescription('Member').setRequired(true),
    ),
  async execute(interaction, { prisma }) {
    const denied = requirePermission(
      interaction,
      PermissionFlagsBits.ModerateMembers,
    );
    if (denied) return;
    const user = interaction.options.getUser('member');
    const result = await prisma.warning.deleteMany({
      where: { guildId: interaction.guild.id, userId: user.id },
    });
    await interaction.reply({
      embeds: [
        successEmbed(
          'Warnings cleared',
          `Removed **${result.count}** warning(s) from ${user}.`,
        ),
      ],
    });
  },
};
