const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const {
  enterGiveaway,
  rerollGiveaway,
} = require('../services/giveaways/giveawayService');
const { sendLog, EVENT_KEYS } = require('../services/logging/logService');
const { MELLUNE_DEFAULT_COLOR_INT } = require('../utils/embeds');
const {
  handleVoiceRoomInteraction,
} = require('../services/voice/voiceRoomService');

const ticketCreationLocks = new Set();

function canManageTicket(interaction, ticket) {
  if (
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
  ) {
    return true;
  }
  const staffRoles = Array.isArray(ticket.category?.staffRoleIds)
    ? ticket.category.staffRoleIds
    : [];
  return staffRoles.some((roleId) => interaction.member?.roles?.cache?.has(roleId));
}

async function createTicketFromCategory(
  interaction,
  prisma,
  categoryId,
  panelId = null,
) {
  const lockKey = `${interaction.guild.id}:${interaction.user.id}:${categoryId}`;
  if (ticketCreationLocks.has(lockKey))
    throw new Error('Your ticket is already being created.');
  ticketCreationLocks.add(lockKey);
  try {
  const panel = panelId
    ? await prisma.ticketPanel.findFirst({
        where: { id: panelId, guildId: interaction.guild.id, enabled: true },
      })
    : null;
  const category = await prisma.ticketCategory.findFirst({
    where: {
      id: categoryId,
      guildId: interaction.guild.id,
      enabled: true,
      ...(panelId ? { panelId } : {}),
    },
  });
  if (panelId && !panel)
    throw new Error('This ticket panel is no longer active.');
  if (!category)
    throw new Error('This ticket category is no longer available.');
  const existingCount = await prisma.ticket.count({
    where: {
      guildId: interaction.guild.id,
      creatorId: interaction.user.id,
      status: 'OPEN',
      categoryId: category.id,
    },
  });
  const maxOpen = panel?.maxOpen || category.maxOpen || 1;
  if (existingCount >= maxOpen) {
    const existing = await prisma.ticket.findFirst({
      where: {
        guildId: interaction.guild.id,
        creatorId: interaction.user.id,
        status: 'OPEN',
        categoryId: category.id,
      },
    });
    throw new Error(
      `You already have ${existingCount} open ticket(s).${
        existing ? ` Latest: <#${existing.channelId}>` : ''
      }`,
    );
  }
  const cooldownSeconds = panel?.cooldownSeconds || category.cooldownSeconds;
  if (cooldownSeconds) {
    const recent = await prisma.ticket.findFirst({
      where: {
        guildId: interaction.guild.id,
        creatorId: interaction.user.id,
        categoryId: category.id,
        createdAt: {
          gte: new Date(Date.now() - cooldownSeconds * 1000),
        },
      },
    });
    if (recent)
      throw new Error(
        'Please wait before opening another ticket in this category.',
      );
  }
  const staffRoles = Array.isArray(category.staffRoleIds)
    ? category.staffRoleIds
    : [];
  const permissionOverwrites = [
    {
      id: interaction.guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    ...(panel?.autoAddStaff === false ? [] : staffRoles).map((roleId) => ({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    })),
  ];
  const me = interaction.guild.members.me;
  if (me) {
    permissionOverwrites.push({
      id: me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }
  const channel = await interaction.guild.channels.create({
    name: `ticket-${interaction.user.username}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 80),
    type: ChannelType.GuildText,
    parent: category.discordCategoryId || undefined,
    permissionOverwrites,
  });
  await prisma.ticket.create({
    data: {
      guildId: interaction.guild.id,
      channelId: channel.id,
      creatorId: interaction.user.id,
      type: category.name,
      categoryId: category.id,
      panelId: panel?.id || category.panelId || null,
    },
  });
  if (panel?.autoWelcome !== false) {
    await channel.send({
      content: panel?.mentionCreator === false ? undefined : `${interaction.user}`,
      allowedMentions: {
        parse: [],
        users: panel?.mentionCreator === false ? [] : [interaction.user.id],
        roles: [],
      },
      embeds: [
        successEmbed(
          'Ticket open',
          category.description || 'Tell us how we can help.',
        ),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket-claim')
            .setLabel('Claim')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('ticket-unclaim')
            .setLabel('Unclaim')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('ticket-transcript')
            .setLabel('Transcript')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('ticket-close')
            .setLabel('Close')
            .setStyle(ButtonStyle.Danger),
        ),
      ],
    });
  }
  await sendLog(
    interaction.client,
    interaction.guild,
    EVENT_KEYS.TICKET,
    'Ticket opened',
    `${interaction.user} opened ${channel}.`,
  ).catch(() => {});
  return channel;
  } finally {
    ticketCreationLocks.delete(lockKey);
  }
}

async function captureTranscript(channel) {
  const messages = channel.messages
    ? await channel.messages.fetch({ limit: 100 }).catch(() => null)
    : null;
  return {
    capturedAt: new Date().toISOString(),
    messages: messages
      ? [...messages.values()]
          .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
          .map((message) => ({
            id: message.id,
            authorId: message.author?.id || null,
            author: message.author?.tag || message.author?.username || 'Unknown',
            content: message.content || '',
            createdAt: new Date(message.createdTimestamp).toISOString(),
            attachments: [...(message.attachments?.values?.() || [])].map(
              (attachment) => attachment.url,
            ),
          }))
      : [],
  };
}

async function handleComponent(interaction, prisma) {
  if (
    interaction.customId.startsWith('voice-room:') ||
    interaction.customId.startsWith('voice-modal:')
  ) {
    return handleVoiceRoomInteraction(interaction, prisma);
  }
  const [action, rawId, extraId] = interaction.customId.split(':');
  if (action === 'ticket-rate') {
    const rating = Number(extraId);
    if (rating < 1 || rating > 5) throw new Error('Invalid ticket rating.');
    const ticket = await prisma.ticket.findFirst({
      where: { id: Number(rawId) },
    });
    if (!ticket || ticket.creatorId !== interaction.user.id)
      throw new Error('Only the ticket creator can submit this rating.');
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { rating, ratedAt: new Date() },
    });
    return interaction.reply({
      content: 'Thanks for rating your ticket.',
      ephemeral: true,
    });
  }
  if (interaction.customId === 'ticket-close') {
    const ticket = await prisma.ticket.findUnique({
      where: { channelId: interaction.channel.id },
      include: { category: true },
    });
    if (!ticket)
      return interaction.reply({
        content: 'This is not an open ticket.',
        ephemeral: true,
      });
    if (
      ticket.status !== 'OPEN' ||
      (ticket.creatorId !== interaction.user.id &&
        !canManageTicket(interaction, ticket))
    ) {
      return interaction.reply({
        content: 'You do not have permission to close this ticket.',
        ephemeral: true,
      });
    }
    const transcript = await captureTranscript(interaction.channel);
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedBy: interaction.user.id,
        transcript,
      },
    });
    await interaction.reply({
      embeds: [successEmbed('Ticket closed', 'This ticket will now be deleted.')],
    });
    await interaction.channel.permissionOverwrites
      .edit(ticket.creatorId, { ViewChannel: false })
      .catch(() => {});
    const creator = await interaction.client.users
      .fetch(ticket.creatorId)
      .catch(() => null);
    if (creator) {
      await creator
        .send({
          content: `How was your experience with ticket #${ticket.id}?`,
          components: [
            new ActionRowBuilder().addComponents(
              ...[1, 2, 3, 4, 5].map((rating) =>
                new ButtonBuilder()
                  .setCustomId(`ticket-rate:${ticket.id}:${rating}`)
                  .setLabel('⭐'.repeat(rating))
                  .setStyle(ButtonStyle.Secondary),
              ),
            ),
          ],
        })
        .catch(() => {});
    }
    await interaction.channel.delete('Mellune ticket closed').catch((error) =>
      console.error(`Failed to delete closed ticket channel: ${error.message}`),
    );
    return;
  }
  if (interaction.customId === 'ticket-transcript') {
    const ticket = await prisma.ticket.findUnique({
      where: { channelId: interaction.channel.id },
      include: { category: true },
    });
    if (!ticket || !canManageTicket(interaction, ticket))
      return interaction.reply({
        content: 'Only ticket staff can request a transcript.',
        ephemeral: true,
      });
    const transcript = ticket.transcript || (await captureTranscript(interaction.channel));
    if (!ticket.transcript) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { transcript },
      });
    }
    return interaction.reply({
      content: `Transcript for ticket #${ticket.id} is stored in the dashboard (${transcript.messages.length} messages captured).`,
      ephemeral: true,
    });
  }
  if (
    interaction.customId === 'ticket-claim' ||
    interaction.customId === 'ticket-unclaim'
  ) {
    const ticket = await prisma.ticket.findUnique({
      where: { channelId: interaction.channel.id },
      include: { category: true },
    });
    if (!ticket)
      return interaction.reply({
        content: 'This is not an open ticket.',
        ephemeral: true,
      });
    if (!canManageTicket(interaction, ticket))
      return interaction.reply({
        content: 'Only configured ticket staff can claim tickets.',
        ephemeral: true,
      });
    const claiming = interaction.customId === 'ticket-claim';
    if (claiming) {
      const result = await prisma.ticket.updateMany({
        where: { id: ticket.id, status: 'OPEN', claimedBy: null },
        data: { claimedBy: interaction.user.id },
      });
      if (!result.count)
        return interaction.reply({
          content: `This ticket is already claimed by <@${ticket.claimedBy}>.`,
          ephemeral: true,
        });
    } else {
      const result = await prisma.ticket.updateMany({
        where: {
          id: ticket.id,
          status: 'OPEN',
          claimedBy: interaction.user.id,
        },
        data: { claimedBy: null },
      });
      if (!result.count)
        return interaction.reply({
          content: 'Only the assigned staff member can unclaim this ticket.',
          ephemeral: true,
        });
    }
    const claimedBy = claiming ? interaction.user.id : null;
    return interaction.reply({
      embeds: [
        successEmbed(
          claimedBy ? 'Ticket claimed' : 'Ticket unclaimed',
          claimedBy
            ? `${interaction.user} is handling this ticket.`
            : 'This ticket is available again.',
        ),
      ],
    });
  }
  if (action === 'ticket-open') {
    await interaction.deferReply({ ephemeral: true });
    const channel = await createTicketFromCategory(
      interaction,
      prisma,
      Number(extraId || rawId),
      extraId ? Number(rawId) : null,
    );
    return interaction.editReply(`Your ticket is ready: ${channel}`);
  }
  if (interaction.customId === 'verify-member') {
    const config = await prisma.verificationConfig.findUnique({
      where: { guildId: interaction.guild.id },
    });
    if (!config?.enabled || !config.roleId)
      throw new Error('Verification is not configured.');
    if (
      config.minAccountAgeHours &&
      Date.now() - interaction.user.createdTimestamp <
        config.minAccountAgeHours * 3600_000
    ) {
      throw new Error('Your Discord account is too new to verify here.');
    }
    await interaction.member.roles.add(config.roleId, 'Mellune verification');
    return interaction.reply({
      embeds: [successEmbed('Verified', 'You now have access to the server.')],
      ephemeral: true,
    });
  }
  if (action === 'giveaway-enter') {
    const result = await enterGiveaway(
      interaction.client,
      Number(rawId),
      interaction.user.id,
      interaction.member,
    );
    return interaction.reply({ content: result.message, ephemeral: true });
  }
  if (action === 'giveaway-reroll') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      throw new Error('You do not have permission to reroll giveaways.');
    }
    const winners = await rerollGiveaway(interaction.client, Number(rawId));
    return interaction.reply(
      `New winners: ${winners.map((id) => `<@${id}>`).join(', ') || 'Nobody.'}`,
    );
  }
  if (action === 'role-panel') {
    const entry = await prisma.reactionRole.findFirst({
      where: {
        id: Number(extraId),
        guildId: interaction.guild.id,
        panelId: Number(rawId),
        messageId: interaction.message.id,
        enabled: true,
      },
      include: { panel: { include: { entries: true } } },
    });
    if (!entry) throw new Error('This role panel option is no longer active.');
    const role = await interaction.guild.roles.fetch(entry.roleId);
    const botHighest = interaction.guild.members.me?.roles.highest.position || 0;
    if (!role || role.managed || role.position >= botHighest)
      throw new Error('The bot cannot manage that role.');
    if (interaction.member.roles.cache.has(role.id)) {
      await interaction.member.roles.remove(role, 'Mellune role panel');
      return interaction.reply({
        content: `Removed **${role.name}**.`,
        ephemeral: true,
      });
    }
    if (entry.panel.exclusiveMode === 'EXCLUSIVE') {
      const otherRoleIds = entry.panel.entries
        .filter((item) => item.id !== entry.id)
        .map((item) => item.roleId);
      for (const otherRoleId of otherRoleIds) {
        if (interaction.member.roles.cache.has(otherRoleId))
          await interaction.member.roles.remove(otherRoleId, 'Exclusive Mellune role panel');
      }
    }
    await interaction.member.roles.add(role, 'Mellune role panel');
    return interaction.reply({
      content: `Added **${role.name}**.`,
      ephemeral: true,
    });
  }
  if (action === 'role-select') {
    const panel = await prisma.reactionRolePanel.findFirst({
      where: {
        id: Number(rawId),
        guildId: interaction.guild.id,
        messageId: interaction.message.id,
        enabled: true,
      },
      include: { entries: { where: { enabled: true } } },
    });
    if (!panel) throw new Error('This role panel is no longer active.');
    const selected = new Set((interaction.values || []).map(Number));
    const chosen = panel.entries.filter((entry) => selected.has(entry.id));
    if (panel.exclusiveMode === 'EXCLUSIVE' && chosen.length > 1)
      throw new Error('Choose only one role in this menu.');
    const botHighest = interaction.guild.members.me?.roles.highest.position || 0;
    for (const entry of panel.entries) {
      const role = await interaction.guild.roles.fetch(entry.roleId);
      if (!role || role.managed || role.position >= botHighest)
        throw new Error(`The bot cannot manage ${entry.label}.`);
      if (selected.has(entry.id)) {
        if (!interaction.member.roles.cache.has(role.id))
          await interaction.member.roles.add(role, 'Mellune role menu');
      } else if (interaction.member.roles.cache.has(role.id)) {
        await interaction.member.roles.remove(role, 'Mellune role menu');
      }
    }
    return interaction.reply({
      content: 'Your role preferences were updated.',
      ephemeral: true,
    });
  }
  if (action === 'role-toggle') {
    const panel = await prisma.reactionRole.findFirst({
      where: {
        messageId: interaction.message.id,
        guildId: interaction.guild.id,
        roleId: rawId,
      },
    });
    if (!panel) throw new Error('This role panel is no longer active.');
    const role = await interaction.guild.roles.fetch(rawId);
    if (
      !role ||
      role.position >= interaction.guild.members.me.roles.highest.position
    )
      throw new Error('The bot cannot manage this role.');
    if (interaction.member.roles.cache.has(rawId)) {
      await interaction.member.roles.remove(role);
      return interaction.reply({
        content: `Removed **${role.name}**.`,
        ephemeral: true,
      });
    }
    await interaction.member.roles.add(role);
    return interaction.reply({
      content: `Added **${role.name}**.`,
      ephemeral: true,
    });
  }
  if (action === 'application-open') {
    const form = await prisma.applicationForm.findFirst({
      where: {
        id: Number(rawId),
        guildId: interaction.guild.id,
        enabled: true,
      },
      include: { questions: { orderBy: { position: 'asc' }, take: 5 } },
    });
    if (!form) throw new Error('This application form is no longer active.');
    const modal = new ModalBuilder()
      .setCustomId(`application-submit:${form.id}`)
      .setTitle(form.title.slice(0, 45));
    modal.addComponents(
      ...form.questions.map((question) =>
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(`question-${question.id}`)
            .setLabel(question.label.slice(0, 45))
            .setPlaceholder(question.prompt.slice(0, 100))
            .setRequired(question.required)
            .setStyle(TextInputStyle.Paragraph),
        ),
      ),
    );
    return interaction.showModal(modal);
  }
  if (action === 'application-submit') {
    const form = await prisma.applicationForm.findFirst({
      where: {
        id: Number(rawId),
        guildId: interaction.guild.id,
        enabled: true,
      },
      include: { questions: true },
    });
    if (!form) throw new Error('This application form is no longer active.');
    const submission = await prisma.applicationSubmission.create({
      data: {
        guildId: interaction.guild.id,
        formId: form.id,
        userId: interaction.user.id,
        answers: {
          create: form.questions
            .map((question) => ({
              questionId: question.id,
              answer: interaction.fields.getTextInputValue(
                `question-${question.id}`,
              ),
            }))
            .filter((answer) => answer.answer),
        },
      },
    });
    const destination = form.destinationChannelId
      ? await interaction.guild.channels
          .fetch(form.destinationChannelId)
          .catch(() => null)
      : null;
    if (destination?.isTextBased()) {
      await destination.send({
        embeds: [
          new EmbedBuilder()
            .setColor(MELLUNE_DEFAULT_COLOR_INT)
            .setTitle(`Application: ${form.title}`)
            .setDescription(
              `From ${interaction.user} · Submission #${submission.id}`,
            )
            .addFields(
              form.questions.map((question) => ({
                name: question.label,
                value:
                  interaction.fields
                    .getTextInputValue(`question-${question.id}`)
                    .slice(0, 1024) || 'No answer',
              })),
            ),
        ],
      });
    }
    return interaction.reply({
      content: 'Your application was submitted.',
      ephemeral: true,
    });
  }
  if (action === 'configured') {
    const definition = await prisma.interactionDefinition.findFirst({
      where: {
        id: Number(rawId),
        guildId: interaction.guild.id,
        enabled: true,
      },
    });
    const buttonIndex = Number(interaction.customId.split(':')[2]);
    const button = definition?.payload?.buttons?.[buttonIndex];
    if (!button) throw new Error('This interaction is no longer active.');
    if (
      button.actionType === 'ROLE_ADD' ||
      button.actionType === 'ROLE_REMOVE'
    ) {
      const role = await interaction.guild.roles.fetch(button.actionValue);
      if (
        !role ||
        role.position >= interaction.guild.members.me.roles.highest.position
      ) {
        throw new Error('The bot cannot manage that role.');
      }
      if (button.actionType === 'ROLE_ADD')
        await interaction.member.roles.add(role);
      else await interaction.member.roles.remove(role);
      return interaction.reply({
        content: 'Your role preferences were updated.',
        ephemeral: true,
      });
    }
    return interaction.reply({
      content: button.actionValue || 'Done.',
      ephemeral: true,
    });
  }
  return false;
}

function attachInteractionHandler(client, commands, prisma) {
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction, { prisma, client });
        return;
      }
      if (
        interaction.isButton() ||
        interaction.isModalSubmit() ||
        interaction.isStringSelectMenu()
      ) {
        await handleComponent(interaction, prisma);
      }
    } catch (error) {
      console.error('Interaction error:', error);
      const response = {
        embeds: [errorEmbed('Something went wrong. Please try again later.')],
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred)
        await interaction.followUp(response);
      else await interaction.reply(response);
    }
  });
}

module.exports = { attachInteractionHandler };
