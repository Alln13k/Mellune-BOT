const PLACEHOLDER = '{membercount}';
const MAX_CHANNEL_NAME = 100;
const GUILD_CATEGORY = 4;
const GUILD_VOICE = 2;
const RECONCILIATION_INTERVAL_MS = 60_000;
const MANAGE_CHANNELS = 1n << 4n;
const DENY_CONNECT_SPEAK_STREAM_VAD =
  (1n << 20n) | (1n << 21n) | (1n << 8n) | (1n << 24n);

function validateFormat(format) {
  if (typeof format !== 'string' || !format.trim()) {
    throw new Error(`Channel format must contain ${PLACEHOLDER}.`);
  }
  if (!format.includes(PLACEHOLDER)) {
    throw new Error(`Channel format must contain ${PLACEHOLDER}.`);
  }
  return format.trim().slice(0, 200);
}

function formatChannelName(format, count) {
  const name = validateFormat(format).replaceAll(
    PLACEHOLDER,
    Number(count).toLocaleString('en-US'),
  );
  if (name.length > MAX_CHANNEL_NAME) {
    throw new Error('The resulting voice channel name cannot exceed 100 characters.');
  }
  return name;
}

function lockedPermissionOverwrites(guild) {
  return [{ id: guild.roles.everyone.id, deny: String(DENY_CONNECT_SPEAK_STREAM_VAD) }];
}

async function syncMemberCounter(client, guildId, options = {}) {
  const prisma = client.prisma;
  const config = await prisma.memberCounterConfig.findUnique({
    where: { guildId },
  });
  if (!config?.enabled) return { enabled: false };
  const guild = await client.guilds.fetch(guildId);
  const count = guild.memberCount;
  const name = formatChannelName(config.format, count);
  let channel = config.channelId
    ? await guild.channels.fetch(config.channelId).catch(() => null)
    : null;
  const category = config.categoryId
    ? await guild.channels.fetch(config.categoryId).catch(() => null)
    : null;
  if (!channel || channel.type !== GUILD_VOICE) {
    if (
      !guild.members.me?.permissions.has(MANAGE_CHANNELS)
    ) {
      throw new Error('Mellune needs Manage Channels to create the member counter.');
    }
    channel = await guild.channels.create({
      name,
      type: GUILD_VOICE,
      parent: category?.type === GUILD_CATEGORY ? category.id : null,
      permissionOverwrites: lockedPermissionOverwrites(guild),
      reason: 'Mellune live member counter',
    });
  } else if (
    options.force ||
    channel.name !== name ||
    (category?.id && channel.parentId !== category.id)
  ) {
    await channel.edit({
      name,
      parent: category?.type === GUILD_CATEGORY ? category.id : null,
      permissionOverwrites: lockedPermissionOverwrites(guild),
      reason: 'Mellune live member counter sync',
    });
  }
  const updated = await prisma.memberCounterConfig.update({
    where: { guildId },
    data: {
      channelId: channel.id,
      lastCount: count,
      lastSyncedAt: new Date(),
    },
  });
  return { enabled: true, count, channel, config: updated };
}

async function syncAllMemberCounters(client) {
  const configs = await client.prisma.memberCounterConfig.findMany({
    where: { enabled: true },
  });
  for (const config of configs) {
    await syncMemberCounter(client, config.guildId).catch((error) =>
      console.error(`Member counter ${config.guildId} sync failed:`, error.message),
    );
  }
}

function startMemberCounterSync(client) {
  const timer = setInterval(
    () => syncAllMemberCounters(client),
    RECONCILIATION_INTERVAL_MS,
  );
  timer.unref?.();
  syncAllMemberCounters(client).catch((error) =>
    console.error('Initial member counter sync failed:', error.message),
  );
  return () => clearInterval(timer);
}

module.exports = {
  formatChannelName,
  startMemberCounterSync,
  syncAllMemberCounters,
  syncMemberCounter,
  validateFormat,
};
