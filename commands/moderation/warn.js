const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createCase } = require('../../services/moderation/caseService');
const { canModerate, requirePermission } = require('../../utils/permissions');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('warn').setDescription('Warn a member.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('member').setDescription('Member').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),
  async execute(interaction, { prisma }) {
    const denied = requirePermission(interaction, PermissionFlagsBits.ModerateMembers);
    if (denied) return;
    const target = await interaction.guild.members.fetch(interaction.options.getUser('member').id);
    const check = canModerate(interaction.member, target, interaction.guild.members.me);
    if (!check.ok) return interaction.reply({ content: check.reason, ephemeral: true });
    const reason = interaction.options.getString('reason');
    const record = await createCase(prisma, { guild: interaction.guild, target, moderator: interaction.user, action: 'WARN', reason });
    await prisma.warning.create({ data: { guildId: interaction.guild.id, userId: target.id, moderatorId: interaction.user.id, reason: reason || 'No reason provided.' } });
    await interaction.reply({ embeds: [successEmbed('Warning issued', `Case **#${record.id}** has been created for ${target}.`)] });
  },
};
