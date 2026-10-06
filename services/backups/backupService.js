const { botFetch } = require('../../lib/discordRest');

function jsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

async function captureSnapshot(prisma, guildId) {
  const [guild, roles, channels, settings, greetings, panels, rolePanels, counter, autoRoles] =
    await Promise.all([
      botFetch(`/guilds/${guildId}?with_counts=true`),
      botFetch(`/guilds/${guildId}/roles`),
      botFetch(`/guilds/${guildId}/channels`),
      prisma.guildSettings.findUnique({ where: { guildId } }),
      prisma.greetingConfig.findMany({ where: { guildId } }),
      prisma.ticketPanel.findMany({
        where: { guildId },
        include: { categories: true },
      }),
      prisma.reactionRolePanel.findMany({
        where: { guildId },
        include: { entries: true },
      }),
      prisma.memberCounterConfig.findUnique({ where: { guildId } }),
      prisma.autoRoleConfig.findUnique({ where: { guildId } }),
    ]);
  const safeRoles = roles.map((role) => ({
    id: role.id,
    name: role.name,
    color: role.color,
    hoist: role.hoist,
    mentionable: role.mentionable,
    position: role.position,
    permissions: role.permissions,
    managed: role.managed,
  }));
  const safeChannels = channels.map((channel) => ({
    id: channel.id,
    name: channel.name,
    type: channel.type,
    position: channel.position,
    parent_id: channel.parent_id,
    topic: channel.topic || null,
    nsfw: channel.nsfw || false,
    rate_limit_per_user: channel.rate_limit_per_user || 0,
    bitrate: channel.bitrate || null,
    user_limit: channel.user_limit || null,
    permission_overwrites: channel.permission_overwrites || [],
  }));
  return jsonValue({
    version: 1,
    guild: {
      id: guild.id,
      name: guild.name,
      verification_level: guild.verification_level,
      default_message_notifications: guild.default_message_notifications,
      system_channel_id: guild.system_channel_id,
      afk_channel_id: guild.afk_channel_id,
      afk_timeout: guild.afk_timeout,
      member_count: guild.member_count,
    },
    roles: safeRoles,
    channels: safeChannels,
    mellune: {
      settings: settings
        ? {
            staffRoleId: settings.staffRoleId,
            ticketCategoryId: settings.ticketCategoryId,
            xpEnabled: settings.xpEnabled,
            suggestionEnabled: settings.suggestionEnabled,
            suggestionChannelId: settings.suggestionChannelId,
            suggestionStaffRoleId: settings.suggestionStaffRoleId,
            levelUpEnabled: settings.levelUpEnabled,
            levelUpChannelId: settings.levelUpChannelId,
            levelUpPayload: settings.levelUpPayload,
            levelUpMention: settings.levelUpMention,
          }
        : null,
      greetings: greetings.map((greeting) => ({
        kind: greeting.kind,
        enabled: greeting.enabled,
        channelId: greeting.channelId,
        title: greeting.title,
        description: greeting.description,
        color: greeting.color,
        footer: greeting.footer,
        thumbnailUrl: greeting.thumbnailUrl,
        imageUrl: greeting.imageUrl,
        useTimestamp: greeting.useTimestamp,
        authorName: greeting.authorName,
        authorIconUrl: greeting.authorIconUrl,
        mentionMode: greeting.mentionMode,
        dmEnabled: greeting.dmEnabled,
        autoRoleId: greeting.autoRoleId,
      })),
      ticketPanels: panels.map((panel) => ({
        panelKey: panel.panelKey,
        name: panel.name,
        channelId: panel.channelId,
        title: panel.title,
        description: panel.description,
        color: panel.color,
        emoji: panel.emoji,
        imageUrl: panel.imageUrl,
        footer: panel.footer,
        payload: panel.payload,
        buttonLabel: panel.buttonLabel,
        buttonStyle: panel.buttonStyle,
        buttonEmoji: panel.buttonEmoji,
        mentionStaff: panel.mentionStaff,
        mentionCreator: panel.mentionCreator,
        autoWelcome: panel.autoWelcome,
        autoAddStaff: panel.autoAddStaff,
        maxOpen: panel.maxOpen,
        cooldownSeconds: panel.cooldownSeconds,
        enabled: panel.enabled,
        categories: panel.categories.map((category) => ({
          name: category.name,
          description: category.description,
          emoji: category.emoji,
          discordCategoryId: category.discordCategoryId,
          staffRoleIds: category.staffRoleIds,
          color: category.color,
          cooldownSeconds: category.cooldownSeconds,
          maxOpen: category.maxOpen,
          enabled: category.enabled,
        })),
      })),
      reactionRolePanels: rolePanels.map((panel) => ({
        name: panel.name,
        channelId: panel.channelId,
        mode: panel.mode,
        title: panel.title,
        description: panel.description,
        color: panel.color,
        authorName: panel.authorName,
        authorIconUrl: panel.authorIconUrl,
        thumbnailUrl: panel.thumbnailUrl,
        imageUrl: panel.imageUrl,
        footer: panel.footer,
        footerIconUrl: panel.footerIconUrl,
        useTimestamp: panel.useTimestamp,
        exclusiveMode: panel.exclusiveMode,
        enabled: panel.enabled,
        entries: panel.entries.map((entry) => ({
          roleId: entry.roleId,
          label: entry.label,
          emoji: entry.emoji,
          description: entry.description,
          mode: entry.mode,
          exclusiveGroup: entry.exclusiveGroup,
          enabled: entry.enabled,
        })),
      })),
      memberCounter: counter
        ? {
            enabled: counter.enabled,
            channelId: counter.channelId,
            categoryId: counter.categoryId,
            format: counter.format,
            lastCount: counter.lastCount,
          }
        : null,
      autoRoles: autoRoles
        ? {
            enabled: autoRoles.enabled,
            roleIds: autoRoles.roleIds,
            ignoreBots: autoRoles.ignoreBots,
          }
        : null,
    },
  });
}

async function restoreDiscordObjects(guildId, snapshot) {
  const currentRoles = await botFetch(`/guilds/${guildId}/roles`);
  const roleMap = new Map([[guildId, guildId]]);
  for (const saved of snapshot.roles.filter((role) => !role.managed && role.id !== guildId)) {
    const current = currentRoles.find((role) => role.name === saved.name);
    const body = {
      name: saved.name,
      color: saved.color,
      hoist: saved.hoist,
      mentionable: saved.mentionable,
      permissions: saved.permissions,
    };
    const role = current
      ? await botFetch(`/guilds/${guildId}/roles/${current.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      : await botFetch(`/guilds/${guildId}/roles`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
    roleMap.set(saved.id, role.id);
  }
  const currentChannels = await botFetch(`/guilds/${guildId}/channels`);
  const channelMap = new Map();
  const categories = snapshot.channels.filter((channel) => channel.type === 4);
  const children = snapshot.channels.filter((channel) => channel.type !== 4);
  for (const saved of [...categories, ...children]) {
    const current = currentChannels.find(
      (channel) => channel.name === saved.name && channel.type === saved.type,
    );
    const parentId = saved.parent_id ? channelMap.get(saved.parent_id) : null;
    const overwrites = saved.permission_overwrites.map((overwrite) => ({
      ...overwrite,
      id: roleMap.get(overwrite.id) || overwrite.id,
    }));
    const body = {
      name: saved.name,
      type: saved.type,
      position: saved.position,
      ...(parentId ? { parent_id: parentId } : {}),
      ...(saved.topic ? { topic: saved.topic } : {}),
      ...(saved.nsfw != null ? { nsfw: saved.nsfw } : {}),
      ...(saved.rate_limit_per_user != null
        ? { rate_limit_per_user: saved.rate_limit_per_user }
        : {}),
      ...(saved.bitrate != null ? { bitrate: saved.bitrate } : {}),
      ...(saved.user_limit != null ? { user_limit: saved.user_limit } : {}),
      permission_overwrites: overwrites,
    };
    const channel = current
      ? await botFetch(`/channels/${current.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      : await botFetch(`/guilds/${guildId}/channels`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
    channelMap.set(saved.id, channel.id);
  }
  return { roleMap, channelMap };
}

async function restoreSnapshot(prisma, guildId, snapshot) {
  if (
    !snapshot ||
    snapshot.version !== 1 ||
    !Array.isArray(snapshot.roles) ||
    !Array.isArray(snapshot.channels)
  ) {
    throw new Error('This backup is invalid or uses an unsupported version.');
  }
  const mappings = await restoreDiscordObjects(guildId, snapshot);
  const settings = snapshot.mellune?.settings;
  if (settings) {
    await prisma.guildSettings.upsert({
      where: { guildId },
      update: {
        staffRoleId: mappings.roleMap.get(settings.staffRoleId) || settings.staffRoleId,
        ticketCategoryId:
          mappings.channelMap.get(settings.ticketCategoryId) ||
          settings.ticketCategoryId,
        xpEnabled: settings.xpEnabled,
        suggestionEnabled: settings.suggestionEnabled,
        suggestionChannelId: mappings.channelMap.get(settings.suggestionChannelId) || settings.suggestionChannelId,
        suggestionStaffRoleId: mappings.roleMap.get(settings.suggestionStaffRoleId) || settings.suggestionStaffRoleId,
        levelUpEnabled: settings.levelUpEnabled,
        levelUpChannelId: mappings.channelMap.get(settings.levelUpChannelId) || settings.levelUpChannelId,
        levelUpPayload: settings.levelUpPayload,
        levelUpMention: settings.levelUpMention,
      },
      create: {
        guildId,
        staffRoleId: mappings.roleMap.get(settings.staffRoleId) || settings.staffRoleId,
        ticketCategoryId:
          mappings.channelMap.get(settings.ticketCategoryId) ||
          settings.ticketCategoryId,
        xpEnabled: settings.xpEnabled,
        suggestionEnabled: settings.suggestionEnabled,
        suggestionChannelId:
          mappings.channelMap.get(settings.suggestionChannelId) ||
          settings.suggestionChannelId,
        suggestionStaffRoleId:
          mappings.roleMap.get(settings.suggestionStaffRoleId) ||
          settings.suggestionStaffRoleId,
        levelUpEnabled: settings.levelUpEnabled,
        levelUpChannelId:
          mappings.channelMap.get(settings.levelUpChannelId) ||
          settings.levelUpChannelId,
        levelUpPayload: settings.levelUpPayload,
        levelUpMention: settings.levelUpMention,
      },
    });
  }
  let greetings = 0;
  for (const greeting of snapshot.mellune?.greetings || []) {
    await prisma.greetingConfig.upsert({
      where: { guildId_kind: { guildId, kind: greeting.kind } },
      update: {
        enabled: greeting.enabled,
        channelId: mappings.channelMap.get(greeting.channelId) || greeting.channelId,
        title: greeting.title,
        description: greeting.description,
        color: greeting.color,
        footer: greeting.footer,
        thumbnailUrl: greeting.thumbnailUrl,
        imageUrl: greeting.imageUrl,
        useTimestamp: greeting.useTimestamp,
        authorName: greeting.authorName,
        authorIconUrl: greeting.authorIconUrl,
        mentionMode: greeting.mentionMode,
        dmEnabled: greeting.dmEnabled,
        autoRoleId: mappings.roleMap.get(greeting.autoRoleId) || greeting.autoRoleId,
      },
      create: {
        guildId,
        kind: greeting.kind,
        enabled: greeting.enabled,
        channelId: mappings.channelMap.get(greeting.channelId) || greeting.channelId,
        title: greeting.title,
        description: greeting.description,
        color: greeting.color,
        footer: greeting.footer,
        thumbnailUrl: greeting.thumbnailUrl,
        imageUrl: greeting.imageUrl,
        useTimestamp: greeting.useTimestamp,
        authorName: greeting.authorName,
        authorIconUrl: greeting.authorIconUrl,
        mentionMode: greeting.mentionMode,
        dmEnabled: greeting.dmEnabled,
        autoRoleId: mappings.roleMap.get(greeting.autoRoleId) || greeting.autoRoleId,
      },
    });
    greetings += 1;
  }
  const reports = {
    roles: mappings.roleMap.size - 1,
    channels: mappings.channelMap.size,
    greetings,
    ticketPanels: 0,
    reactionRolePanels: 0,
    queuedJobs: 0,
    warnings: [],
  };
  const queueJob = (type, payload) =>
    prisma.botJob
      .create({ data: { guildId, type, payload } })
      .then(() => {
        reports.queuedJobs += 1;
      });
  for (const panel of snapshot.mellune?.ticketPanels || []) {
    const panelData = {
      guildId,
      channelId: mappings.channelMap.get(panel.channelId) || panel.channelId,
      messageId: null,
      panelKey: panel.panelKey,
      name: panel.name,
      title: panel.title,
      description: panel.description,
      color: panel.color,
      emoji: panel.emoji,
      imageUrl: panel.imageUrl,
      footer: panel.footer,
      payload: panel.payload,
      buttonLabel: panel.buttonLabel,
      buttonStyle: panel.buttonStyle,
      buttonEmoji: panel.buttonEmoji,
      mentionStaff: panel.mentionStaff,
      mentionCreator: panel.mentionCreator,
      autoWelcome: panel.autoWelcome,
      autoAddStaff: panel.autoAddStaff,
      maxOpen: panel.maxOpen,
      cooldownSeconds: panel.cooldownSeconds,
      enabled: panel.enabled,
    };
    const categories = panel.categories || [];
    const saved = await prisma.ticketPanel.upsert({
      where: { guildId_panelKey: { guildId, panelKey: panel.panelKey } },
      update: panelData,
      create: panelData,
    });
    for (const category of categories) {
      const existingCategory = await prisma.ticketCategory.findFirst({
        where: { guildId, panelId: saved.id, name: category.name },
      });
      const categoryData = {
        guildId,
        panelId: saved.id,
        name: category.name,
        description: category.description,
        emoji: category.emoji,
        discordCategoryId:
          mappings.channelMap.get(category.discordCategoryId) ||
          category.discordCategoryId,
        staffRoleIds: (Array.isArray(category.staffRoleIds)
          ? category.staffRoleIds
          : []
        ).map((roleId) => mappings.roleMap.get(roleId) || roleId),
        color: category.color,
        cooldownSeconds: category.cooldownSeconds,
        maxOpen: category.maxOpen,
        enabled: category.enabled,
      };
      if (existingCategory) {
        await prisma.ticketCategory.update({
          where: { id: existingCategory.id },
          data: categoryData,
        });
      } else {
        await prisma.ticketCategory.create({ data: categoryData });
      }
    }
    await prisma.ticketCategory.deleteMany({
      where: {
        guildId,
        panelId: saved.id,
        ...(categories.length
          ? { name: { notIn: categories.map((category) => category.name) } }
          : {}),
      },
    });
    reports.ticketPanels += 1;
    if (saved.enabled && saved.channelId) {
      await queueJob('PUBLISH_TICKET_PANEL', {
        panelId: saved.id,
        channelId: saved.channelId,
      });
    }
  }
  for (const panel of snapshot.mellune?.reactionRolePanels || []) {
    const saved = await prisma.reactionRolePanel.upsert({
      where: { guildId_name: { guildId, name: panel.name } },
      update: {
        channelId: mappings.channelMap.get(panel.channelId) || panel.channelId,
        messageId: null,
        mode: panel.mode,
        title: panel.title,
        description: panel.description,
        color: panel.color,
        authorName: panel.authorName,
        authorIconUrl: panel.authorIconUrl,
        thumbnailUrl: panel.thumbnailUrl,
        imageUrl: panel.imageUrl,
        footer: panel.footer,
        footerIconUrl: panel.footerIconUrl,
        useTimestamp: panel.useTimestamp,
        exclusiveMode: panel.exclusiveMode,
        enabled: panel.enabled,
      },
      create: {
        guildId,
        name: panel.name,
        channelId: mappings.channelMap.get(panel.channelId) || panel.channelId,
        mode: panel.mode,
        title: panel.title,
        description: panel.description,
        color: panel.color,
        authorName: panel.authorName,
        authorIconUrl: panel.authorIconUrl,
        thumbnailUrl: panel.thumbnailUrl,
        imageUrl: panel.imageUrl,
        footer: panel.footer,
        footerIconUrl: panel.footerIconUrl,
        useTimestamp: panel.useTimestamp,
        exclusiveMode: panel.exclusiveMode,
        enabled: panel.enabled,
      },
    });
    await prisma.reactionRole.deleteMany({ where: { panelId: saved.id } });
    for (const entry of panel.entries || []) {
      await prisma.reactionRole.create({
        data: {
          guildId,
          panelId: saved.id,
          channelId: mappings.channelMap.get(panel.channelId) || panel.channelId,
          messageId: null,
          roleId: mappings.roleMap.get(entry.roleId) || entry.roleId,
          label: entry.label,
          emoji: entry.emoji,
          description: entry.description,
          mode: entry.mode,
          exclusiveGroup: entry.exclusiveGroup,
          enabled: entry.enabled,
        },
      });
    }
    reports.reactionRolePanels += 1;
    if (saved.enabled && saved.channelId) {
      await queueJob('SEND_REACTION_ROLE_PANEL', { panelId: saved.id });
    }
  }
  const counter = snapshot.mellune?.memberCounter;
  if (counter) {
    await prisma.memberCounterConfig.upsert({
      where: { guildId },
      update: {
        enabled: counter.enabled,
        channelId: mappings.channelMap.get(counter.channelId) || counter.channelId,
        categoryId: mappings.channelMap.get(counter.categoryId) || counter.categoryId,
        format: counter.format,
        lastCount: counter.lastCount,
        lastSyncedAt: null,
      },
      create: {
        guildId,
        enabled: counter.enabled,
        channelId: mappings.channelMap.get(counter.channelId) || counter.channelId,
        categoryId: mappings.channelMap.get(counter.categoryId) || counter.categoryId,
        format: counter.format,
        lastCount: counter.lastCount,
      },
    });
  }
  const autoRoles = snapshot.mellune?.autoRoles;
  if (autoRoles) {
    await prisma.autoRoleConfig.upsert({
      where: { guildId },
      update: {
        enabled: autoRoles.enabled,
        roleIds: (Array.isArray(autoRoles.roleIds) ? autoRoles.roleIds : []).map(
          (roleId) => mappings.roleMap.get(roleId) || roleId,
        ),
        ignoreBots: autoRoles.ignoreBots,
      },
      create: {
        guildId,
        enabled: autoRoles.enabled,
        roleIds: (Array.isArray(autoRoles.roleIds) ? autoRoles.roleIds : []).map(
          (roleId) => mappings.roleMap.get(roleId) || roleId,
        ),
        ignoreBots: autoRoles.ignoreBots,
      },
    });
  }
  return { ...reports, mappings: { roles: Object.fromEntries(mappings.roleMap), channels: Object.fromEntries(mappings.channelMap) } };
}

module.exports = { captureSnapshot, restoreSnapshot };
