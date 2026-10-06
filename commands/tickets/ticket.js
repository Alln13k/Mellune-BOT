const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('ticket').setDescription('Create or manage a private support ticket.')
    .addSubcommand((s) => s.setName('create').setDescription('Open a ticket.').addStringOption((o) => o.setName('type').setDescription('Ticket type').setRequired(true).addChoices(
      { name: 'General Support', value: 'general' }, { name: 'Report', value: 'report' }, { name: 'Partnership', value: 'partnership' }, { name: 'Staff Application', value: 'application' }, { name: 'Other', value: 'other' },
    )))
    .addSubcommand((s) => s.setName('close').setDescription('Close this ticket.')),
  async execute(interaction, { prisma }) {
    if (interaction.options.getSubcommand() === 'close') {
      const ticket = await prisma.ticket.findUnique({ where: { channelId: interaction.channel.id } });
      if (!ticket) return interaction.reply({ content: 'This channel is not an open Mellune ticket.', ephemeral: true });
      await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'CLOSED', closedAt: new Date() } });
      await interaction.reply({ embeds: [successEmbed('Ticket closed', 'This channel will be archived shortly.')] });
      return interaction.channel.permissionOverwrites.edit(ticket.creatorId, { ViewChannel: false }).catch(() => {});
    }
    const existing = await prisma.ticket.findFirst({ where: { guildId: interaction.guild.id, creatorId: interaction.user.id, status: 'OPEN' } });
    if (existing) return interaction.reply({ content: `You already have an open ticket: <#${existing.channelId}>`, ephemeral: true });
    const type = interaction.options.getString('type');
    const channel = await interaction.guild.channels.create({ name: `ticket-${interaction.user.username}`.slice(0, 90), type: ChannelType.GuildText, permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: interaction.guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
    ] });
    await prisma.ticket.create({ data: { guildId: interaction.guild.id, channelId: channel.id, creatorId: interaction.user.id, type } });
    await channel.send({ content: `${interaction.user}`, embeds: [successEmbed('Ticket open', 'Please describe how we can help. Use `/ticket close` when your request is resolved.')], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket-close').setLabel('Close').setStyle(ButtonStyle.Danger))] });
    await interaction.reply({ content: `Your ticket is ready: ${channel}`, ephemeral: true });
  },
};
