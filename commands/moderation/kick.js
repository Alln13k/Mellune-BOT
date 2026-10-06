const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { canModerate, requirePermission } = require('../../utils/permissions');
const { createCase } = require('../../services/moderation/caseService');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) =>
      option.setName('member').setDescription('Member').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason').setRequired(false),
    ),
  async execute(interaction, { prisma }) {
    if (requirePermission(interaction, PermissionFlagsBits.KickMembers)) return;
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
    const reason =
      interaction.options.getString('reason') || 'No reason provided.';
    await target.kick(reason);
    const record = await createCase(prisma, {
      guild: interaction.guild,
      target,
      moderator: interaction.user,
      action: 'KICK',
      reason,
    });
    return interaction.reply({
      embeds: [
        successEmbed(
          'Member kicked',
          `${target.user} — Case **#${record.id}**`,
        ),
      ],
    });
  },
};
