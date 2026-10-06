const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
} = require('discord.js');
const { MELLUNE_DEFAULT_COLOR_INT } = require('../../utils/embeds');

function roomPanelPayload(room, channel) {
  const users = channel?.members?.size || 0;
  const limit = room.userLimit ? `${room.userLimit} users` : 'Unlimited';
  const privateMode = room.privacy === 'PRIVATE';
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(MELLUNE_DEFAULT_COLOR_INT)
        .setTitle('🎙️ Voice Room Controls')
        .setDescription(
          `Owner: <@${room.ownerId}>\nPrivacy: ${privateMode ? '🔒 Private' : '🔓 Public'}\nLimit: ${limit}\nConnected users: ${users}${room.userLimit ? `/${room.userLimit}` : ''}`,
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`voice-room:${room.id}:${privateMode ? 'unlock' : 'lock'}`)
          .setLabel(privateMode ? 'Unlock' : 'Lock')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`voice-room:${room.id}:limit`)
          .setLabel('User limit')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`voice-room:${room.id}:rename`)
          .setLabel('Rename')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`voice-room:${room.id}:transfer`)
          .setLabel('Transfer')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`voice-room:${room.id}:delete`)
          .setLabel('Delete')
          .setStyle(ButtonStyle.Danger),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`voice-room:${room.id}:whitelist`)
          .setLabel('Whitelist')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`voice-room:${room.id}:block`)
          .setLabel('Block user')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`voice-room:${room.id}:users`)
          .setLabel('Manage users')
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  };
}

function canManageRoom(interaction, room, config) {
  if (room.ownerId === interaction.user.id) return true;
  if (
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
  ) {
    return true;
  }
  const staffRoleIds = Array.isArray(config?.staffRoleIds)
    ? config.staffRoleIds
    : [];
  return staffRoleIds.some((roleId) => interaction.member?.roles?.cache?.has(roleId));
}

async function findRoom(interaction, prisma, roomId) {
  return prisma.temporaryVoiceRoom.findFirst({
    where: { id: Number(roomId), guildId: interaction.guild.id },
    include: { config: true },
  });
}

async function refreshPanel(interaction, room, channel) {
  if (!room.panelMessageId || !channel?.messages) return;
  const message = await channel.messages.fetch(room.panelMessageId).catch(() => null);
  if (message) await message.edit(roomPanelPayload(room, channel)).catch(() => {});
}

async function createVoiceRoom({ newState, prisma, config, formatName }) {
  const guild = newState.guild;
  const activeRooms = await prisma.temporaryVoiceRoom.count({
    where: { guildId: guild.id },
  });
  if (config.maxRooms && activeRooms >= config.maxRooms) return null;
  const parent = config.categoryId
    ? await guild.channels.fetch(config.categoryId).catch(() => null)
    : null;
  const privacy = config.defaultPrivacy === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC';
  const staffRoleIds = Array.isArray(config.staffRoleIds)
    ? config.staffRoleIds
    : [];
  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      ...(privacy === 'PRIVATE'
        ? { deny: [PermissionFlagsBits.Connect] }
        : { allow: [PermissionFlagsBits.Connect] }),
    },
    {
      id: newState.member.id,
      allow: [
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.ViewChannel,
      ],
    },
    ...staffRoleIds.map((roleId) => ({
      id: roleId,
      allow: [
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.MoveMembers,
      ],
    })),
  ];
  const channel = await guild.channels.create({
    name: formatName(config.nameFormat, newState.member),
    type: 2,
    parent:
      parent?.type === 4
        ? parent.id
        : undefined,
    userLimit: Math.max(0, Math.min(99, config.userLimit || 0)),
    permissionOverwrites,
  });
  const room = await prisma.temporaryVoiceRoom.create({
    data: {
      guildId: guild.id,
      channelId: channel.id,
      textChannelId: channel.id,
      ownerId: newState.member.id,
      privacy,
      userLimit: Math.max(0, Math.min(99, config.userLimit || 0)),
      whitelist: [],
      blocked: [],
    },
  });
  const panel =
    typeof channel.send === 'function'
      ? await channel.send(roomPanelPayload(room, channel)).catch(() => null)
      : null;
  if (panel) {
    await prisma.temporaryVoiceRoom.update({
      where: { id: room.id },
      data: { panelMessageId: panel.id },
    });
    room.panelMessageId = panel.id;
  }
  await newState.setChannel(channel).catch(async () => {
    await prisma.temporaryVoiceRoom.delete({ where: { id: room.id } }).catch(() => {});
    await channel.delete('Could not move member into temporary channel').catch(() => {});
  });
  return room;
}

function modalFor(roomId, action, title, label, placeholder) {
  return new ModalBuilder()
    .setCustomId(`voice-modal:${roomId}:${action}`)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('value')
          .setLabel(label)
          .setPlaceholder(placeholder)
          .setRequired(true)
          .setStyle(TextInputStyle.Short),
      ),
    );
}

async function handleVoiceRoomInteraction(interaction, prisma) {
  const parts = interaction.customId.split(':');
  const kind = parts[0];
  const roomId = parts[1];
  const action = parts[2];
  if (!['voice-room', 'voice-modal'].includes(kind)) return false;
  const room = await findRoom(interaction, prisma, roomId);
  if (!room) throw new Error('This voice room no longer exists.');
  if (!canManageRoom(interaction, room, room.config))
    throw new Error('You are not the owner of this voice room.');
  const channel = await interaction.guild.channels.fetch(room.channelId).catch(() => null);
  if (!channel) {
    await prisma.temporaryVoiceRoom.delete({ where: { id: room.id } });
    throw new Error('This voice room was deleted.');
  }
  if (kind === 'voice-room') {
    if (action === 'delete') {
      await prisma.temporaryVoiceRoom.delete({ where: { id: room.id } });
      await interaction.reply({ content: 'Voice room deleted.', ephemeral: true });
      await channel.delete('Voice room owner requested deletion').catch(() => {});
      return true;
    }
    if (action === 'lock' || action === 'unlock') {
      const privacy = action === 'lock' ? 'PRIVATE' : 'PUBLIC';
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        Connect: privacy === 'PUBLIC',
      });
      const updated = await prisma.temporaryVoiceRoom.update({
        where: { id: room.id },
        data: { privacy },
      });
      await interaction.reply({
        content: privacy === 'PRIVATE' ? 'Room locked.' : 'Room unlocked.',
        ephemeral: true,
      });
      await refreshPanel(interaction, updated, channel);
      return true;
    }
    if (action === 'limit')
      return interaction.showModal(
        modalFor(room.id, 'limit', 'Set user limit', 'Limit (0 = unlimited)', '0'),
      );
    if (action === 'rename')
      return interaction.showModal(
        modalFor(room.id, 'rename', 'Rename voice room', 'Channel name', 'Gaming with friends'),
      );
    if (action === 'transfer')
      return interaction.showModal(
        modalFor(room.id, 'transfer', 'Transfer ownership', 'Discord user ID', '123456789012345678'),
      );
    if (action === 'whitelist' || action === 'block')
      return interaction.showModal(
        modalFor(
          room.id,
          action,
          action === 'whitelist' ? 'Add to whitelist' : 'Block user',
          'Discord user ID',
          '123456789012345678',
        ),
      );
    if (action === 'users') {
      const users = [...channel.members.values()]
        .map((member) => `<@${member.id}>`)
        .join(', ');
      return interaction.reply({
        content: `Connected users: ${users || 'Nobody'}`,
        ephemeral: true,
      });
    }
  }
  if (kind === 'voice-modal') {
    const value = interaction.fields.getTextInputValue('value').trim();
    if (action === 'limit') {
      const userLimit = Math.min(99, Math.max(0, Number(value) || 0));
      await channel.setUserLimit(userLimit);
      const updated = await prisma.temporaryVoiceRoom.update({
        where: { id: room.id },
        data: { userLimit },
      });
      await interaction.reply({ content: `User limit set to ${userLimit || 'unlimited'}.`, ephemeral: true });
      await refreshPanel(interaction, updated, channel);
      return true;
    }
    if (action === 'rename') {
      const name = value.toLowerCase().replace(/[^a-z0-9 _-]/g, '').trim().slice(0, 100);
      if (!name) throw new Error('Enter a valid channel name.');
      await channel.setName(name);
      await interaction.reply({ content: `Room renamed to **${name}**.`, ephemeral: true });
      await refreshPanel(interaction, room, channel);
      return true;
    }
    if (action === 'transfer') {
      const member = await interaction.guild.members.fetch(value).catch(() => null);
      if (!member) throw new Error('That Discord user is not in this server.');
      const updated = await prisma.temporaryVoiceRoom.update({
        where: { id: room.id },
        data: { ownerId: member.id },
      });
      await channel.permissionOverwrites.edit(member, {
        Connect: true,
        ManageChannels: true,
        MoveMembers: true,
        ViewChannel: true,
      });
      await interaction.reply({ content: `Ownership transferred to ${member}.`, ephemeral: true });
      await refreshPanel(interaction, updated, channel);
      return true;
    }
    if (action === 'whitelist' || action === 'block') {
      const member = await interaction.guild.members.fetch(value).catch(() => null);
      if (!member) throw new Error('That Discord user is not in this server.');
      const listKey = action === 'whitelist' ? 'whitelist' : 'blocked';
      const list = Array.isArray(room[listKey]) ? room[listKey] : [];
      const next = [...new Set([...list, member.id])].filter((id) =>
        action === 'whitelist'
          ? id !== room.ownerId
          : true,
      );
      const otherKey = action === 'whitelist' ? 'blocked' : 'whitelist';
      const other = (Array.isArray(room[otherKey]) ? room[otherKey] : []).filter(
        (id) => id !== member.id,
      );
      const updated = await prisma.temporaryVoiceRoom.update({
        where: { id: room.id },
        data: { [listKey]: next, [otherKey]: other },
      });
      await channel.permissionOverwrites.edit(member, {
        Connect: action === 'whitelist' || room.privacy === 'PUBLIC',
        ViewChannel: action === 'whitelist' || room.privacy === 'PUBLIC',
      });
      if (action === 'block')
        await channel.permissionOverwrites.edit(member, {
          Connect: false,
          ViewChannel: false,
        });
      await interaction.reply({
        content: `${member} ${action === 'whitelist' ? 'added to the whitelist.' : 'blocked from this room.'}`,
        ephemeral: true,
      });
      await refreshPanel(interaction, updated, channel);
      return true;
    }
  }
  return false;
}

module.exports = {
  canManageRoom,
  createVoiceRoom,
  handleVoiceRoomInteraction,
  modalFor,
  roomPanelPayload,
};
