const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { canModerate, requirePermission } = require('../../utils/permissions');
const { createCase } = require('../../services/moderation/caseService');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) =>
      o.setName('member').setDescription('Member').setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName('minutes')
        .setDescription('Duration in minutes')
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true),
    )
    .addStringOption((o) =>
      o.setName('reason').setDescription('Reason').setRequired(false),
    ),
  async execute(interaction, { prisma }) {
    const denied = requirePermission(
      interaction,
      PermissionFlagsBits.ModerateMembers,
    );
    if (denied) return;
    const target = await interaction.guild.members.fetch(
      interaction.options.getUser('member').id,
    );
    const check = canModerate(
      interaction.member,
      target,
      interaction.guild.members.me,
    );
    if (!check.ok)
      return interaction.reply({ content: check.reason, ephemeral: true });
    const minutes = interaction.options.getInteger('minutes');
    await target.timeout(
      minutes * 60 * 1000,
      interaction.options.getString('reason') || 'No reason provided.',
    );
    const record = await createCase(prisma, {
      guild: interaction.guild,
      target,
      moderator: interaction.user,
      action: 'TIMEOUT',
      reason: interaction.options.getString('reason'),
    });
    await interaction.reply({
      embeds: [
        successEmbed('Member timed out', `${target} — Case **#${record.id}**`),
      ],
    });
  },
};
