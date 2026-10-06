const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { requirePermission } = require('../../utils/permissions');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete recent messages.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((o) =>
      o
        .setName('amount')
        .setDescription('1 to 100 messages')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    ),
  async execute(interaction) {
    const denied = requirePermission(
      interaction,
      PermissionFlagsBits.ManageMessages,
    );
    if (denied) return;
    const amount = interaction.options.getInteger('amount');
    const deleted = await interaction.channel.bulkDelete(amount, true);
    await interaction.reply({
      embeds: [
        successEmbed(
          'Messages removed',
          `Deleted **${deleted.size}** message(s).`,
        ),
      ],
      ephemeral: true,
    });
  },
};
