const { ChannelType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { createEvent } = require('../../services/events/eventService');
const { isValidTimeZone } = require('../../services/events/eventLogic');
const { requirePermission } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Create and publish a community event.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) => option.setName('name').setDescription('Event name').setRequired(true).setMaxLength(100))
    .addStringOption((option) => option.setName('date').setDescription('Start date, YYYY-MM-DD').setRequired(true))
    .addStringOption((option) => option.setName('time').setDescription('Start time, HH:mm').setRequired(true))
    .addChannelOption((option) => option
      .setName('channel')
      .setDescription('Channel where the event is posted')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true))
    .addStringOption((option) => option.setName('description').setDescription('What members should know').setMaxLength(1000))
    .addStringOption((option) => option.setName('location').setDescription('Location or room name').setMaxLength(100))
    .addIntegerOption((option) => option.setName('capacity').setDescription('Maximum attendees').setMinValue(1).setMaxValue(5000))
    .addStringOption((option) => option.setName('timezone').setDescription('Timezone, for example Europe/Paris').setRequired(false)),
  async execute(interaction, { prisma }) {
    const denied = requirePermission(interaction, PermissionFlagsBits.ManageGuild);
    if (denied) return;
    const timezone = interaction.options.getString('timezone') || 'UTC';
    if (!isValidTimeZone(timezone)) {
      await interaction.reply({ content: 'Choose a valid IANA timezone, such as Europe/Paris.', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const event = await createEvent(prisma, interaction.client, {
      guildId: interaction.guild.id,
      guildName: interaction.guild.name,
      actorId: interaction.user.id,
      body: {
        name: interaction.options.getString('name'),
        date: interaction.options.getString('date'),
        time: interaction.options.getString('time'),
        timezone,
        channelId: interaction.options.getChannel('channel').id,
        description: interaction.options.getString('description') || '',
        location: interaction.options.getString('location') || '',
        maxAttendees: interaction.options.getInteger('capacity'),
        durationMinutes: 120,
        publish: true,
        organizerId: interaction.user.id,
        reminders: [{ offsetMinutes: 60, targets: ['DM'], includeTentative: false }],
      },
    });
    await interaction.editReply({
      content: event.messageId
        ? `**${event.name}** is posted in <#${event.channelId}>.`
        : `**${event.name}** was saved, but Discord did not return a message.`,
    });
  },
};
