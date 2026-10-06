const { sendLog, EVENT_KEYS } = require('../logging/logService');

const joins = new Map();

function rememberJoin(guildId, member) {
  const now = Date.now();
  const current = (joins.get(guildId) || []).filter(
    (item) => now - item.at < 10 * 60_000,
  );
  current.push({
    at: now,
    userId: member.id,
    createdAt: member.user.createdTimestamp,
  });
  joins.set(guildId, current);
  return current;
}

async function handleJoin(member, prisma) {
  const config = await prisma.raidProtectionConfig.findUnique({
    where: { guildId: member.guild.id },
  });
  if (!config?.enabled) return false;
  const entries = rememberJoin(member.guild.id, member);
  const recent = entries.filter(
    (entry) => Date.now() - entry.at <= config.windowSeconds * 1000,
  );
  const suspicious = config.suspiciousOnly
    ? recent.filter(
        (entry) =>
          Date.now() - entry.createdAt <
          config.minAccountAgeHours * 60 * 60_000,
      )
    : recent;
  if (suspicious.length < config.joinThreshold) return false;

  const reason = `Raid protection: ${suspicious.length} suspicious joins in ${config.windowSeconds}s`;
  if (config.action === 'KICK' && member.kickable) {
    await member.kick(reason).catch(() => {});
  } else if (config.action === 'TIMEOUT' && member.moderatable) {
    await member.timeout(10 * 60 * 1000, reason).catch(() => {});
  }
  await sendLog(
    member.client,
    member.guild,
    EVENT_KEYS.RAID,
    'Raid protection triggered',
    reason,
    [
      { name: 'Response', value: config.action, inline: true },
      { name: 'Window', value: `${config.windowSeconds}s`, inline: true },
    ],
  ).catch(() => {});
  return true;
}

function clearGuildState(guildId) {
  joins.delete(guildId);
}

module.exports = { clearGuildState, handleJoin, rememberJoin };
