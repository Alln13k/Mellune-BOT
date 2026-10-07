const { buildEmbed } = require('../embedService');
const { MELLUNE_DEFAULT_COLOR_INT } = require('../../utils/embeds');
const { sendGreetingTest } = require('../welcome/welcomeService');
const { publishTicketPanel } = require('../ticket/ticketPanelService');
const {
  completeGiveaway,
  processEndedGiveaways,
  rerollGiveaway,
  startGiveaway,
} = require('../giveaways/giveawayService');
const { connectGuild } = require('../voice/voicePresenceService');

const POLL_MS = 5000;

function nextRecurrence(date, recurrence) {
  const next = new Date(date);
  if (recurrence === 'hourly') next.setHours(next.getHours() + 1);
  else if (recurrence === 'daily') next.setDate(next.getDate() + 1);
  else if (recurrence === 'weekly') next.setDate(next.getDate() + 7);
  else if (recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
  else return null;
  return next;
}

async function sendToChannel(client, channelId, payload) {
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased())
    throw new Error('Target channel is not text-based.');
  return channel.send(payload);
}

function contextForGuild(guild) {
  return {
    server: guild.name,
    serverid: guild.id,
    membercount: guild.memberCount,
  };
}

async function executeJob(client, job) {
  const payload = job.payload || {};
  if (job.type === 'SEND_EMBED') {
    const guild = await client.guilds.fetch(job.guildId);
    return sendToChannel(client, payload.channelId, {
      content: payload.content || undefined,
      embeds: [buildEmbed(payload.embed, contextForGuild(guild))],
      allowedMentions: payload.allowedMentions || { parse: [] },
    });
  }
  if (job.type === 'SEND_ANNOUNCEMENT') {
    const guild = await client.guilds.fetch(job.guildId);
    const message = await sendToChannel(client, payload.channelId, {
      content: payload.content || undefined,
      embeds: payload.embed
        ? [buildEmbed(payload.embed, contextForGuild(guild))]
        : [],
      allowedMentions: payload.allowedMentions || { parse: [] },
    });
    if (payload.announcementId) {
      await client.prisma.announcement.update({
        where: { id: payload.announcementId },
        data: { status: 'SENT', sentAt: new Date() },
      });
    }
    return message;
  }
  if (job.type === 'TEST_GREETING') {
    return sendGreetingTest(client, job.guildId, payload.userId, payload.kind);
  }
  if (job.type === 'PUBLISH_TICKET_PANEL') {
    return publishTicketPanel(
      client,
      job.guildId,
      payload.channelId,
      payload.panelId,
    );
  }
  if (job.type === 'ROLE_ASSIGN' || job.type === 'ROLE_REMOVE') {
    const guild = await client.guilds.fetch(job.guildId);
    const member = await guild.members.fetch(payload.userId);
    const role = await guild.roles.fetch(payload.roleId);
    if (
      !role ||
      !member.manageable ||
      role.position >= guild.members.me.roles.highest.position
    ) {
      throw new Error('Discord role hierarchy prevents this action.');
    }
    return job.type === 'ROLE_ASSIGN'
      ? member.roles.add(role, 'Mellune dashboard action')
      : member.roles.remove(role, 'Mellune dashboard action');
  }
  if (job.type === 'CREATE_ROLE' || job.type === 'EDIT_ROLE') {
    const guild = await client.guilds.fetch(job.guildId);
    if (job.type === 'CREATE_ROLE') {
      return guild.roles.create({
        name: payload.name,
        color: payload.color,
        hoist: payload.hoist,
        mentionable: payload.mentionable,
        reason: 'Mellune dashboard role management',
      });
    }
    const role = await guild.roles.fetch(payload.roleId);
    if (!role || role.position >= guild.members.me.roles.highest.position) {
      throw new Error('Discord role hierarchy prevents this edit.');
    }
    return role.edit({
      name: payload.name || undefined,
      color: payload.color || undefined,
      hoist: payload.hoist,
      mentionable: payload.mentionable,
      reason: 'Mellune dashboard role management',
    });
  }
  if (job.type === 'SEND_VERIFICATION_PANEL') {
    const {
      ActionRowBuilder,
      ButtonBuilder,
      ButtonStyle,
      EmbedBuilder,
    } = require('discord.js');
    const message = await sendToChannel(client, payload.channelId, {
      embeds: [
        new EmbedBuilder()
          .setColor(MELLUNE_DEFAULT_COLOR_INT)
          .setTitle(payload.title)
          .setDescription(payload.description),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('verify-member')
            .setLabel(payload.buttonLabel || 'Verify')
            .setStyle(ButtonStyle.Primary),
        ),
      ],
    });
    await client.prisma.verificationConfig.update({
      where: { guildId: job.guildId },
      data: { messageId: message.id },
    });
    return message;
  }
  if (job.type === 'SEND_APPLICATION_PANEL') {
    const {
      ActionRowBuilder,
      ButtonBuilder,
      ButtonStyle,
      EmbedBuilder,
    } = require('discord.js');
    const form = await client.prisma.applicationForm.findFirst({
      where: {
        id: payload.formId,
        guildId: job.guildId,
        enabled: true,
        deletedAt: null,
      },
      include: {
        questions: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
          take: 5,
        },
      },
    });
    if (!form || !form.destinationChannelId) {
      throw new Error('Application form is no longer publishable.');
    }
    const message = await sendToChannel(client, form.destinationChannelId, {
      embeds: [
        new EmbedBuilder()
          .setColor(MELLUNE_DEFAULT_COLOR_INT)
          .setTitle(form.title)
          .setDescription(form.description),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`application-open:${form.id}`)
            .setLabel('Apply')
            .setStyle(ButtonStyle.Primary),
        ),
      ],
    });
    return message;
  }
  if (job.type === 'SEND_INTERACTION_PANEL') {
    const {
      ActionRowBuilder,
      ButtonBuilder,
      ButtonStyle,
    } = require('discord.js');
    const style = {
      PRIMARY: ButtonStyle.Primary,
      SECONDARY: ButtonStyle.Secondary,
      SUCCESS: ButtonStyle.Success,
      DANGER: ButtonStyle.Danger,
      LINK: ButtonStyle.Link,
    };
    const buttons = (payload.buttons || []).map((button, index) => {
      const builder = new ButtonBuilder()
        .setLabel(button.label)
        .setStyle(style[button.style] || ButtonStyle.Secondary);
      if (button.style === 'LINK') builder.setURL(button.url);
      else builder.setCustomId(`configured:${payload.definitionId}:${index}`);
      return builder;
    });
    const message = await sendToChannel(client, payload.channelId, {
      content: payload.content || undefined,
      embeds:
        payload.embed?.title || payload.embed?.description
          ? [
              buildEmbed(
                payload.embed,
                contextForGuild(await client.guilds.fetch(job.guildId)),
              ),
            ]
          : [],
      components: buttons.length
        ? [new ActionRowBuilder().addComponents(buttons)]
        : [],
    });
    return message;
  }
  if (job.type === 'SEND_REACTION_ROLE_PANEL') {
    const {
      ActionRowBuilder,
      ButtonBuilder,
      ButtonStyle,
      StringSelectMenuBuilder,
    } = require('discord.js');
    const panel = await client.prisma.reactionRolePanel.findFirst({
      where: { id: payload.panelId, guildId: job.guildId, enabled: true },
      include: { entries: { where: { enabled: true }, orderBy: { id: 'asc' } } },
    });
    if (!panel) throw new Error('Role panel is no longer active.');
    const channel = await client.channels.fetch(panel.channelId);
    if (!channel?.isTextBased()) throw new Error('Role panel channel is invalid.');
    const embed = buildEmbed({
      title: panel.title,
      description: panel.description,
      color: panel.color,
      timestamp: panel.useTimestamp,
      author: panel.authorName
        ? {
            name: panel.authorName,
            iconUrl: panel.authorIconUrl,
          }
        : null,
      thumbnail: panel.thumbnailUrl ? { url: panel.thumbnailUrl } : null,
      image: panel.imageUrl ? { url: panel.imageUrl } : null,
      footer: panel.footer
        ? { text: panel.footer, iconUrl: panel.footerIconUrl }
        : null,
    });
    const rows = [];
    if (panel.mode === 'SELECT') {
      rows.push(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`role-select:${panel.id}`)
            .setPlaceholder('Choose your roles')
            .setMinValues(0)
            .setMaxValues(panel.exclusiveMode === 'EXCLUSIVE' ? 1 : Math.min(25, panel.entries.length))
            .addOptions(
              panel.entries.slice(0, 25).map((entry) => ({
                label: entry.label.slice(0, 100),
                value: String(entry.id),
                description: entry.description?.slice(0, 100),
                emoji: entry.emoji || undefined,
              })),
            ),
        ),
      );
    } else if (panel.mode === 'BUTTON') {
      for (let index = 0; index < panel.entries.length; index += 5) {
        rows.push(
          new ActionRowBuilder().addComponents(
            ...panel.entries.slice(index, index + 5).map((entry) =>
              new ButtonBuilder()
                .setCustomId(`role-panel:${panel.id}:${entry.id}`)
                .setLabel(entry.label.slice(0, 80))
                .setEmoji(entry.emoji || '🔘')
                .setStyle(ButtonStyle.Secondary),
            ),
          ),
        );
      }
    }
    let message = null;
    if (panel.messageId && channel.messages) {
      message = await channel.messages
        .fetch(panel.messageId)
        .then((existing) => existing.edit({ embeds: [embed], components: rows }))
        .catch(() => null);
    }
    message ||= await channel.send({ embeds: [embed], components: rows });
    if (panel.mode === 'REACTION') {
      for (const entry of panel.entries) {
        await message.react(entry.emoji).catch(() => {});
      }
    }
    await client.prisma.reactionRolePanel.update({
      where: { id: panel.id },
      data: { messageId: message.id },
    });
    await client.prisma.reactionRole.updateMany({
      where: { panelId: panel.id },
      data: { channelId: channel.id, messageId: message.id },
    });
    return message;
  }
  if (job.type === 'SEND_ROLE_PANEL') {
    const {
      ActionRowBuilder,
      ButtonBuilder,
      ButtonStyle,
      EmbedBuilder,
    } = require('discord.js');
    const message = await sendToChannel(client, payload.channelId, {
      embeds: [
        new EmbedBuilder()
          .setColor(MELLUNE_DEFAULT_COLOR_INT)
          .setTitle(payload.title || 'Choose your roles')
          .setDescription(
            payload.description || 'Select a button to update your roles.',
          ),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          ...payload.roles
            .slice(0, 5)
            .map((role) =>
              new ButtonBuilder()
                .setCustomId(`role-toggle:${role.roleId}`)
                .setLabel(role.label)
                .setStyle(ButtonStyle.Secondary),
            ),
        ),
      ],
    });
    await client.prisma.reactionRole.createMany({
      data: payload.roles.slice(0, 5).map((role) => ({
        guildId: job.guildId,
        channelId: payload.channelId,
        messageId: message.id,
        roleId: role.roleId,
        label: role.label,
      })),
    });
    return message;
  }
  if (job.type === 'SEND_REMINDER') {
    return sendToChannel(client, payload.channelId, {
      content: `<@${payload.userId}> ${payload.message}`,
      allowedMentions: { parse: [], users: [payload.userId], roles: [] },
    });
  }
  if (job.type === 'START_GIVEAWAY') {
    const giveaway = await client.prisma.giveaway.findUnique({
      where: { id: payload.giveawayId },
    });
    if (!giveaway) throw new Error('Giveaway no longer exists.');
    return startGiveaway(client, giveaway);
  }
  if (job.type === 'END_GIVEAWAY') {
    return completeGiveaway(client, payload.giveawayId, { manual: true });
  }
  if (job.type === 'REROLL_GIVEAWAY') {
    return rerollGiveaway(client, payload.giveawayId, {
      count: payload.count,
      excludePrevious: payload.excludePrevious === true,
    });
  }
  if (job.type === 'SYNC_VOICE_PRESENCE') {
    return connectGuild(client, job.guildId);
  }
  throw new Error(`Unknown bot job: ${job.type}`);
}

async function processDueReminders(client) {
  const reminders = await client.prisma.reminder.findMany({
    where: { status: 'PENDING', dueAt: { lte: new Date() } },
    take: 25,
  });
  for (const reminder of reminders) {
    const claimed = await client.prisma.reminder.updateMany({
      where: { id: reminder.id, status: 'PENDING' },
      data: { status: 'DELIVERING' },
    });
    if (!claimed.count) continue;
    try {
      await executeJob(client, {
        guildId: reminder.guildId,
        type: 'SEND_REMINDER',
        payload: {
          channelId: reminder.channelId,
          userId: reminder.userId,
          message: reminder.message,
        },
      });
      const next = nextRecurrence(reminder.dueAt, reminder.recurrence);
      await client.prisma.reminder.update({
        where: { id: reminder.id },
        data: next
          ? { status: 'PENDING', dueAt: next, lastDeliveredAt: new Date() }
          : { status: 'SENT', lastDeliveredAt: new Date() },
      });
    } catch (error) {
      await client.prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          status: 'PENDING',
          dueAt: new Date(Date.now() + 10_000),
        },
      });
      console.error('Reminder delivery failed:', error.message);
    }
  }
}

async function processScheduledAnnouncements(client) {
  const announcements = await client.prisma.announcement.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: new Date() },
    },
    take: 25,
  });
  for (const announcement of announcements) {
    await client.prisma.$transaction(async (tx) => {
      const claimed = await tx.announcement.updateMany({
        where: { id: announcement.id, status: 'SCHEDULED' },
        data: { status: 'QUEUED' },
      });
      if (!claimed.count) return;
      await tx.botJob.create({
        data: {
          guildId: announcement.guildId,
          type: 'SEND_ANNOUNCEMENT',
          payload: {
            announcementId: announcement.id,
            channelId: announcement.channelId,
            content: announcement.content,
            embed: announcement.payload,
            allowedMentions: {
              parse: [
                ...(announcement.allowEveryone || announcement.allowHere
                  ? ['everyone']
                  : []),
              ],
              roles: announcement.roleId ? [announcement.roleId] : [],
              users: [],
            },
          },
        },
      });
    });
  }
}

async function processPendingJobs(client) {
  await client.prisma.botJob.updateMany({
    where: {
      status: 'RUNNING',
      claimedAt: { lt: new Date(Date.now() - 5 * 60_000) },
    },
    data: { status: 'PENDING', claimedAt: null },
  });
  const jobs = await client.prisma.botJob.findMany({
    where: {
      status: 'PENDING',
      runAt: { lte: new Date() },
    },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });
  for (const job of jobs) {
    const claimed = await client.prisma.botJob.updateMany({
      where: { id: job.id, status: 'PENDING' },
      data: {
        status: 'RUNNING',
        claimedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    if (!claimed.count) continue;
    try {
      await executeJob(client, job);
      await client.prisma.botJob.update({
        where: { id: job.id },
        data: { status: 'DONE', completedAt: new Date() },
      });
    } catch (error) {
      const retry = job.attempts < 3;
      await client.prisma.botJob.update({
        where: { id: job.id },
        data: {
          status: retry ? 'PENDING' : 'FAILED',
          runAt: retry
            ? new Date(Date.now() + job.attempts * 10_000)
            : undefined,
          error: error.message.slice(0, 500),
        },
      });
      console.error(`Bot job ${job.id} failed:`, error.message);
    }
  }
}

function startJobWorker(client) {
  let running = false;
  const tick = async () => {
    if (running || !client.isReady()) return;
    running = true;
    try {
      await processPendingJobs(client);
      await processDueReminders(client);
      await processScheduledAnnouncements(client);
      await processEndedGiveaways(client);
    } catch (error) {
      console.error('Scheduler tick failed:', error.message);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, POLL_MS);
  timer.unref?.();
  tick();
  return () => clearInterval(timer);
}

module.exports = {
  executeJob,
  nextRecurrence,
  processDueReminders,
  processPendingJobs,
  startJobWorker,
};
