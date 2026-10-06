const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { requirePermission } = require('../../utils/permissions');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure Mellune features.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('leveling')
        .setDescription('Enable or disable XP.')
        .addBooleanOption((o) =>
          o.setName('enabled').setDescription('Enabled').setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('welcome')
        .setDescription('Set the welcome channel.')
        .addChannelOption((o) =>
          o.setName('channel').setDescription('Channel').setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('logs')
        .setDescription('Set the moderation log channel.')
        .addChannelOption((o) =>
          o.setName('channel').setDescription('Channel').setRequired(true),
        ),
    ),
  async execute(interaction, { prisma }) {
    const denied = requirePermission(
      interaction,
      PermissionFlagsBits.ManageGuild,
    );
    if (denied) return;
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'leveling') {
      await prisma.guildSettings.upsert({
        where: { guildId: interaction.guild.id },
        update: { xpEnabled: interaction.options.getBoolean('enabled') },
        create: {
          guildId: interaction.guild.id,
          xpEnabled: interaction.options.getBoolean('enabled'),
        },
      });
    } else if (subcommand === 'welcome') {
      const channelId = interaction.options.getChannel('channel').id;
      await prisma.welcomeConfig.upsert({
        where: { guildId: interaction.guild.id },
        update: {
          channelId,
          enabled: true,
        },
        create: {
          guildId: interaction.guild.id,
          channelId,
          enabled: true,
        },
      });
      await prisma.greetingConfig.upsert({
        where: {
          guildId_kind: { guildId: interaction.guild.id, kind: 'WELCOME' },
        },
        update: { channelId, enabled: true },
        create: {
          guildId: interaction.guild.id,
          kind: 'WELCOME',
          channelId,
          enabled: true,
        },
      });
    } else {
      await prisma.logConfig.upsert({
        where: { guildId: interaction.guild.id },
        update: {
          moderationLogId: interaction.options.getChannel('channel').id,
        },
        create: {
          guildId: interaction.guild.id,
          moderationLogId: interaction.options.getChannel('channel').id,
        },
      });
    }
    await interaction.reply({
      embeds: [
        successEmbed(
          'Configuration saved',
          `The \`${subcommand}\` settings have been updated.`,
        ),
      ],
      ephemeral: true,
    });
  },
};
