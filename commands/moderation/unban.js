const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { requirePermission, PermissionFlagsBits: Permissions } = require('../../utils/permissions');
const { createCase } = require('../../services/moderation/caseService');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by id.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((option) =>
      option.setName('user_id').setDescription('Discord user id').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason').setRequired(false),
    ),
  async execute(interaction, { prisma }) {
    if (requirePermission(interaction, Permissions.BanMembers)) return;
    const userId = interaction.options.getString('user_id');
    if (!/^\d{15,25}$/.test(userId)) {
      return interaction.reply({ content: 'That is not a valid Discord user id.', ephemeral: true });
    }
    const reason = interaction.options.getString('reason') || 'No reason provided.';
    const user = await interaction.client.users.fetch(userId);
    await interaction.guild.members.unban(userId, reason);
    const record = await createCase(prisma, {
      guild: interaction.guild,
      target: { id: user.id, user },
      moderator: interaction.user,
      action: 'UNBAN',
      reason,
    });
    return interaction.reply({
      embeds: [successEmbed('User unbanned', `${user} — Case **#${record.id}**`)],
    });
  },
};
