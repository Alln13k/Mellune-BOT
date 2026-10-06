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

async function createTicketFromCategory(interaction, prisma, categoryId) {
  const category = await prisma.ticketCategory.findFirst({
    where: { id: categoryId, guildId: interaction.guild.id, enabled: true },
  });
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
  if (existingCount >= (category.maxOpen || 1)) {
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
  if (category.cooldownSeconds) {
    const recent = await prisma.ticket.findFirst({
      where: {
        guildId: interaction.guild.id,
        creatorId: interaction.user.id,
        categoryId: category.id,
        createdAt: {
          gte: new Date(Date.now() - category.cooldownSeconds * 1000),
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
    ...staffRoles.map((roleId) => ({
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
    },
  });
  await channel.send({
    content: `${interaction.user}`,
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
          .setCustomId('ticket-close')
          .setLabel('Close')
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  });
  await sendLog(
    interaction.client,
    interaction.guild,
    EVENT_KEYS.TICKET,
    'Ticket opened',
    `${interaction.user} opened ${channel}.`,
  ).catch(() => {});
  return channel;
}

async function handleComponent(interaction, prisma) {
  const [action, rawId] = interaction.customId.split(':');
  if (interaction.customId === 'ticket-close') {
    const ticket = await prisma.ticket.findUnique({
      where: { channelId: interaction.channel.id },
    });
    if (!ticket)
      return interaction.reply({
        content: 'This is not an open ticket.',
        ephemeral: true,
      });
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    await interaction.reply({
      embeds: [successEmbed('Ticket closed', 'This ticket is now archived.')],
    });
    await interaction.channel.permissionOverwrites
      .edit(ticket.creatorId, { ViewChannel: false })
      .catch(() => {});
    return;
  }
  if (
    interaction.customId === 'ticket-claim' ||
    interaction.customId === 'ticket-unclaim'
  ) {
    const ticket = await prisma.ticket.findUnique({
      where: { channelId: interaction.channel.id },
    });
    if (!ticket)
      return interaction.reply({
        content: 'This is not an open ticket.',
        ephemeral: true,
      });
    const claimedBy =
      interaction.customId === 'ticket-claim' ? interaction.user.id : null;
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { claimedBy },
    });
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
      Number(rawId),
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
      prisma,
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
            .setColor('#b9a7ff')
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
      if (interaction.isButton() || interaction.isModalSubmit()) {
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
