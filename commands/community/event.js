const { ChannelType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const {
  cancelEvent,
  createEvent,
  endEvent,
  getEvent,
  listEvents,
  publishEvent,
  sendReminderNow,
  updateEvent,
} = require('../../services/events/eventService');
const { formatEventWhen, isValidTimeZone, statusLabel } = require('../../services/events/eventLogic');
const { requirePermission } = require('../../utils/permissions');

function eventOption() {
  return (option) => option
    .setName('event')
    .setDescription('Event')
    .setRequired(true)
    .setAutocomplete(true);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Post an event. Reminders go out on their own.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('create')
      .setDescription('Post an event. Going members are reminded automatically.')
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
      .addStringOption((option) => option.setName('timezone').setDescription('Timezone, for example Europe/Paris'))
      .addStringOption((option) => option.setName('image').setDescription('Optional direct image URL').setMaxLength(500)))
    .addSubcommand((sub) => sub
      .setName('list')
      .setDescription('See coming up, happening now, or finished events.')
      .addStringOption((option) => option
        .setName('status')
        .setDescription('Which events to show')
        .addChoices(
          { name: 'Coming up', value: 'coming' },
          { name: 'Happening now', value: 'live' },
          { name: 'Finished', value: 'past' },
          { name: 'Cancelled', value: 'cancelled' },
        )))
    .addSubcommand((sub) => sub
      .setName('info')
      .setDescription('See who is going and who is waiting.')
      .addStringOption(eventOption()))
    .addSubcommand((sub) => sub
      .setName('edit')
      .setDescription('Change the name, time, channel, or capacity.')
      .addStringOption(eventOption())
      .addStringOption((option) => option.setName('name').setDescription('New name').setMaxLength(100))
      .addStringOption((option) => option.setName('date').setDescription('New date, YYYY-MM-DD'))
      .addStringOption((option) => option.setName('time').setDescription('New time, HH:mm'))
      .addChannelOption((option) => option
        .setName('channel')
        .setDescription('New channel')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addStringOption((option) => option.setName('location').setDescription('New location').setMaxLength(100))
      .addIntegerOption((option) => option.setName('capacity').setDescription('New attendee limit').setMinValue(1).setMaxValue(5000))
      .addStringOption((option) => option.setName('description').setDescription('New description').setMaxLength(1000))
      .addStringOption((option) => option.setName('timezone').setDescription('Timezone used for the new date')))
    .addSubcommand((sub) => sub
      .setName('publish')
      .setDescription('Post an event that was not posted yet.')
      .addStringOption(eventOption()))
    .addSubcommand((sub) => sub
      .setName('cancel')
      .setDescription('Cancel an event. People who are going get a DM.')
      .addStringOption(eventOption())
      .addStringOption((option) => option
        .setName('scope')
        .setDescription('What to cancel')
        .addChoices(
          { name: 'This event', value: 'one' },
          { name: 'Entire series', value: 'series' },
        )))
    .addSubcommand((sub) => sub
      .setName('end')
      .setDescription('Mark an event as finished.')
      .addStringOption(eventOption()))
    .addSubcommand((sub) => sub
      .setName('remind')
      .setDescription('DM everyone who is going, right now.')
      .addStringOption(eventOption())),
  async autocomplete(interaction, { prisma }) {
    const focused = interaction.options.getFocused().toLowerCase();
    const events = await prisma.communityEvent.findMany({
      where: {
        guildId: interaction.guild.id,
        ...(focused ? { name: { contains: focused, mode: 'insensitive' } } : {}),
      },
      orderBy: { startAt: 'asc' },
      take: 25,
    });
    await interaction.respond(events.map((event) => ({
      name: `${event.name} · ${formatEventWhen(event).date} ${formatEventWhen(event).time}`.slice(0, 100),
      value: String(event.id),
    })));
  },
  async execute(interaction, { prisma }) {
    const denied = requirePermission(interaction, PermissionFlagsBits.ManageGuild);
    if (denied) return;
    const sub = interaction.options.getSubcommand();
    const context = {
      guildId: interaction.guild.id,
      actorId: interaction.user.id,
      eventId: Number(interaction.options.getString('event')),
    };
    await interaction.deferReply({ ephemeral: true });
    if (sub === 'create') return createFromCommand(interaction, prisma);
    if (sub === 'list') return listFromCommand(interaction, prisma);
    if (sub === 'info') return infoFromCommand(interaction, prisma, context);
    if (sub === 'edit') return editFromCommand(interaction, prisma, context);
    if (sub === 'publish') {
      const event = await publishEvent(prisma, interaction.client, context);
      return interaction.editReply({ content: `**${event.name}** is posted in <#${event.channelId}>.` });
    }
    if (sub === 'cancel') {
      const count = await cancelEvent(prisma, interaction.client, {
        ...context,
        scope: interaction.options.getString('scope') || 'one',
      });
      return interaction.editReply({ content: count > 1 ? `${count} events were cancelled.` : 'The event was cancelled.' });
    }
    if (sub === 'end') {
      const event = await endEvent(prisma, interaction.client, context);
      return interaction.editReply({ content: `**${event.name}** is finished.` });
    }
    await sendReminderNow(prisma, interaction.client, context);
    return interaction.editReply({ content: 'Reminder sent to everyone who is going.' });
  },
};

async function createFromCommand(interaction, prisma) {
  const timezone = interaction.options.getString('timezone') || 'UTC';
  if (!isValidTimeZone(timezone)) {
    return interaction.editReply({ content: 'Choose a valid IANA timezone, such as Europe/Paris.' });
  }
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
      imageUrl: interaction.options.getString('image') || '',
      maxAttendees: interaction.options.getInteger('capacity'),
      durationMinutes: 120,
      publish: true,
      organizerId: interaction.user.id,
    },
  });
  return interaction.editReply({
    content: event.messageId
      ? `**${event.name}** is posted in <#${event.channelId}>. People can tap Going now and get a DM 15 minutes before and when it starts.`
      : `**${event.name}** was saved, but Discord did not return a message.`,
  });
}

async function listFromCommand(interaction, prisma) {
  const listed = await listEvents(prisma, interaction.guild.id, {
    bucket: interaction.options.getString('status') || 'coming',
    page: 1,
  });
  if (!listed.items.length) return interaction.editReply({ content: 'Nothing here yet.' });
  const lines = listed.items.slice(0, 10).map((event) => {
    const when = formatEventWhen(event);
    const capacity = event.maxAttendees ? ` / ${event.maxAttendees}` : '';
    return `**${event.name}** · ${when.date} ${when.time} · ${statusLabel(event.status)} · ${event.counts.going}${capacity} going`;
  });
  return interaction.editReply({ content: lines.join('\n').slice(0, 1900) });
}

async function infoFromCommand(interaction, prisma, context) {
  const event = await getEvent(prisma, context.guildId, context.eventId);
  if (!event) return interaction.editReply({ content: 'That event no longer exists.' });
  const when = formatEventWhen(event);
  const going = event.attendees.going.slice(0, 15).map((person) => person.displayName).join(', ') || 'Nobody yet';
  const waiting = event.attendees.waitlist.slice(0, 10).map((person) => `#${person.position} ${person.displayName}`).join(', ') || 'Empty';
  return interaction.editReply({
    content: [
      `**${event.name}** · ${statusLabel(event.status)}`,
      `${when.date} · ${when.time}${when.end ? ` – ${when.end}` : ''} (${when.timeZone})`,
      event.location ? `Location: ${event.location}` : null,
      `Going: ${event.counts.going}${event.maxAttendees ? ` / ${event.maxAttendees}` : ''} · ${going}`,
      `Waitlist: ${event.counts.waitlist} · ${waiting}`,
      event.channelId ? `Channel: <#${event.channelId}>` : null,
    ].filter(Boolean).join('\n').slice(0, 1900),
  });
}

async function editFromCommand(interaction, prisma, context) {
  const body = {};
  for (const key of ['name', 'date', 'time', 'location', 'description', 'timezone']) {
    const value = interaction.options.getString(key);
    if (value) body[key] = value;
  }
  const channel = interaction.options.getChannel('channel');
  if (channel) body.channelId = channel.id;
  const capacity = interaction.options.getInteger('capacity');
  if (capacity) body.maxAttendees = capacity;
  if (!Object.keys(body).length) return interaction.editReply({ content: 'Choose at least one thing to change.' });
  if ((body.date || body.time) && (!body.date || !body.time)) {
    return interaction.editReply({ content: 'Provide both the new date and the new time.' });
  }
  if (body.timezone && !isValidTimeZone(body.timezone)) {
    return interaction.editReply({ content: 'Choose a valid IANA timezone, such as Europe/Paris.' });
  }
  const event = await updateEvent(prisma, interaction.client, { ...context, body });
  const when = formatEventWhen(event);
  return interaction.editReply({ content: `**${event.name}** was updated · ${when.date} ${when.time}.` });
}
