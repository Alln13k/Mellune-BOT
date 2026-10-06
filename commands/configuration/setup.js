const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { requirePermission } = require('../../utils/permissions');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Create Mellune defaults for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction, { prisma }) {
    const denied = requirePermission(
      interaction,
      PermissionFlagsBits.ManageGuild,
    );
    if (denied) return;
    await prisma.guild.upsert({
      where: { id: interaction.guild.id },
      update: { name: interaction.guild.name },
      create: { id: interaction.guild.id, name: interaction.guild.name },
    });
    await prisma.guildSettings.upsert({
      where: { guildId: interaction.guild.id },
      update: {},
      create: { guildId: interaction.guild.id },
    });
    await prisma.welcomeConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: {},
      create: { guildId: interaction.guild.id },
    });
    await prisma.greetingConfig.upsert({
      where: {
        guildId_kind: { guildId: interaction.guild.id, kind: 'WELCOME' },
      },
      update: {},
      create: {
        guildId: interaction.guild.id,
        kind: 'WELCOME',
        title: 'Welcome to {server}',
        description: 'Welcome {user}!',
      },
    });
    await prisma.greetingConfig.upsert({
      where: {
        guildId_kind: { guildId: interaction.guild.id, kind: 'GOODBYE' },
      },
      update: {},
      create: {
        guildId: interaction.guild.id,
        kind: 'GOODBYE',
        title: 'Goodbye',
        description: '{username} has left {server}.',
      },
    });
    await prisma.logConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: {},
      create: { guildId: interaction.guild.id },
    });
    await interaction.reply({
      embeds: [
        successEmbed(
          'Setup ready',
          'Mellune defaults are ready. Use `/config` commands to customize this server.',
        ),
      ],
      ephemeral: true,
    });
  },
};
